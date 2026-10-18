import { it, expect, vi } from 'vitest';
import receipt from './__fixtures__/python-execution.json';
import { LabExecutionStateSchema } from '../../contracts/lab-execution';
import { acceptedFrom, currentScope, observationAge, projectSnapshot } from './floating-guidance';
const full = () => LabExecutionStateSchema.parse(receipt.start);
const committed = () => LabExecutionStateSchema.parse(receipt.events.find(e => e.type === 'guidance_committed')!.state);
it('Python guidance and procedure drive Now/Next without granting assessment', () => {
  const state = full(), view = projectSnapshot(state);
  expect(view.instructions.now?.title).toBe(state.guidance.current_action!.title);
  expect(view.instructions.next?.title).toBe(state.guidance.next_action!.title);
  expect(currentScope(state).visit_id).toBe(state.current_visit_id);
  expect(view).not.toHaveProperty('assessment');
});
it('normalizes Python capture status and bounded committed projection consistently', () => {
  expect(committed().runtime.capture_active).toBe(true);
  expect(full().runtime.capture_active).toBe(true);
  const state = full(); state.runtime.capture_active = false;
  expect(projectSnapshot(state).screen_context.status).toBe('disconnected');
  state.runtime.capture_active = true; state.status = 'paused'; expect(projectSnapshot(state).screen_context.status).toBe('paused');
  state.status = 'completed'; expect(projectSnapshot(state).instructions.now).toBeNull();
});
it('ages accepted reads monotonically and marks previous scope/stale observations earlier', () => {
  const state = committed(); const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const accepted = acceptedFrom(state)!; expect(accepted).toBeTruthy();
  expect(projectSnapshot(state, { accepted, ageMs: 100 }).screen_context.status).toBe('fresh');
  clock.mockReturnValue(31000); expect(observationAge(accepted)).toBeGreaterThanOrEqual(30000);
  expect(projectSnapshot(state, { accepted, ageMs: observationAge(accepted) }).screen_context.status).toBe('earlier');
  state.workspace.view_revision++; expect(projectSnapshot(state, { accepted, ageMs: 100 }).screen_context.status).toBe('earlier');
  clock.mockRestore();
});
it('retains earlier accepted context while waiting and limits text and findings', () => {
  const state = committed(), accepted = acceptedFrom(state)!;
  state.runtime.analysis_status = 'waiting_for_provider'; state.runtime.candidate = null;
  expect(acceptedFrom(state, accepted)).toBe(accepted);
  expect(projectSnapshot(state, { accepted, ageMs: 1 }).screen_context.status).toBe('unavailable');
  state.guidance.current_action!.title = 'x'.repeat(4000);
  expect(projectSnapshot(state).instructions.now!.title).toHaveLength(600);
});
