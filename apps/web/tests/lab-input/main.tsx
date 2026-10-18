/** Synthetic UI harness only; no auth, network, screen capture or production import. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExecutionRequirementsSchema, LabExecutionStateSchema } from '../../src/contracts/lab-execution';
import { ServiceError } from '../../src/services/types';
import { LabStudentInput } from '../../src/features/labs/LabStudentInput';
import type { LabCaptureView } from '../../src/features/labs/lab-capture';
import { projectSnapshot } from '../../src/features/labs/floating-guidance';
import receipt from '../../src/features/labs/__fixtures__/python-execution.json';
import requirements from '../../src/features/labs/__fixtures__/lab-input-requirements.json';
import '../../src/ui/styles.css';
import '../../src/ui/sketchbook.css';
import '../../src/ui/account-material.css';
import '../../src/ui/feedback.css';

function Harness() {
  const [state, setState] = useState(() => LabExecutionStateSchema.parse(receipt.start));
  const [fail, setFail] = useState(false);
  const [count, setCount] = useState(0);
  const snapshot = projectSnapshot(state); snapshot.screen_context.status = 'fresh';
  const view: LabCaptureView = { state: { ...state, runtime: { ...state.runtime, analysis_status: 'available' } }, snapshot, requirements: ExecutionRequirementsSchema.parse(requirements), requirementsError: '', phase: 'active', reason: 'Synthetic UI check', extension: { bound: true, present: true, superseded: false }, preview: null, reading: false, retryAfterMs: 0, recovering: false, canRecover: false, inputBusy: false };
  return <main style={{ maxWidth: 1000, padding: 16, margin: '0 auto' }}><h1>Synthetic lab input UI check</h1><p>No learner, backend, capture or assessed proficiency.</p><button type="button" onClick={() => setFail(!fail)}>Toggle API failure</button><button type="button" onClick={() => setState(old => ({ ...old, workspace: { ...old.workspace, view_revision: old.workspace.view_revision + 1 } }))}>Change screen context</button><p data-testid="submission-count">Confirmed submissions: {count}</p><LabStudentInput view={view} retryRequirements={() => {}} submitInput={async () => { await new Promise(resolve => setTimeout(resolve, 100)); if (fail) throw new ServiceError('Controlled service outage. Your draft is kept.', 503); setCount(n => n + 1); setState(old => ({ ...old, revision: old.revision + 1 })); }} /></main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
