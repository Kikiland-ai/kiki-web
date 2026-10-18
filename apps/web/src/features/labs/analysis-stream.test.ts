import { describe, it, expect, vi } from 'vitest';
import receipt from './__fixtures__/python-execution.json';
import { LabExecutionStateSchema, FrameReceiptSchema } from '../../contracts/lab-execution';
import { currentScope } from './floating-guidance';
import { startAnalysisStream } from './analysis-stream';
function run(events: unknown[] = receipt.events, fragment = false) {
  // Re-sequence because optional auxiliary/provisional packets were pruned from receipt.
  const data = events.map((e, i) => `data: ${JSON.stringify({ ...(e as object), event_sequence: i + 1 })}\r\n\r\n`).join('');
  const bytes = new TextEncoder().encode(data);
  const response = new Response(new ReadableStream({ start(c) { if (fragment) for (const byte of bytes) c.enqueue(new Uint8Array([byte])); else c.enqueue(bytes); c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const onCommit = vi.fn(), onPreview = vi.fn();
  const state = LabExecutionStateSchema.parse(receipt.start);
  return { ...startAnalysisStream(response, { frame: FrameReceiptSchema.parse(receipt.frame), context: currentScope(state), signal: new AbortController().signal, onCommit, onPreview }), onCommit, onPreview };
}
describe('actual Python decision receipts', () => {
  it('parses Python full and committed record-shaped state and fragmented Odia SSE', async () => {
    const stream = run(receipt.events, true);
    await expect(stream.committed).resolves.toMatchObject({ kind: 'committed' });
    await stream.completion;
    expect(stream.onCommit).toHaveBeenCalledTimes(1);
    expect(stream.onCommit.mock.calls[0][0].projection).toBe('committed-decision/v1');
  });
  it('refuses a foreign frame before it can update guidance', async () => {
    const events = structuredClone(receipt.events); events[0].frame!.frame_id = 'foreign';
    const stream = run(events);
    await expect(stream.committed).rejects.toThrow('frame changed'); expect(stream.onCommit).not.toHaveBeenCalled();
  });
  it('rejects a truncated decision without adopting preview text', async () => {
    const stream = run(receipt.events.filter(e => e.type !== 'guidance_committed' && e.type !== 'stream_complete'));
    await expect(stream.committed).rejects.toThrow('before completion'); expect(stream.onCommit).not.toHaveBeenCalled();
  });
  it('late auxiliary state never replaces committed guidance', async () => {
    const events: unknown[] = structuredClone(receipt.events);
    const index = receipt.events.findIndex(e => e.type === 'stream_complete');
    events.splice(index, 0, { ...receipt.events.find(e => e.type === 'guidance_committed')!, type: 'state_snapshot', state: receipt.start });
    const stream = run(events); await stream.committed; await stream.completion;
    expect(stream.onCommit).toHaveBeenCalledTimes(1);
  });
  it('provisional multilingual prose is labelled preview and has no decision authority', async () => {
    const events: unknown[] = [...receipt.events];
    events.splice(1, 0, { schema: 'lab-analysis-stream/v2', request_id: receipt.events[0].request_id,
      type: 'provisional_findings', context: receipt.events[0].context, provisional: true,
      finding: { status: 'unknown', evidence: 'Tentative ଓଡ଼ିଆ screen detail.' } });
    const stream = run(events, true); await stream.committed; await stream.completion;
    expect(stream.onPreview).toHaveBeenCalledWith('Tentative ଓଡ଼ିଆ screen detail.');
    expect(stream.onCommit).toHaveBeenCalledTimes(1);
    expect(stream.onCommit.mock.calls[0][0].runtime.candidate.summary).not.toContain('Tentative');
  });
  it('rejects a foreign admitted context and a foreign request id', async () => {
    const context = structuredClone(receipt.events); context[0].context!.workspace_id = 'foreign';
    const first = run(context); await expect(first.committed).rejects.toThrow('context changed');
    const request = structuredClone(receipt.events); request[1].request_id = 'foreign';
    const second = run(request); await expect(second.committed).rejects.toThrow('out-of-order');
    expect(first.onCommit).not.toHaveBeenCalled(); expect(second.onCommit).not.toHaveBeenCalled();
  });
  it('rejects a queue which disagrees with the committed state', async () => {
    const events = structuredClone(receipt.events); const core = events.find(e => e.type === 'guidance_committed')!;
    (core.queue!.done_checkpoint_ids as string[]).push('CP-DSB-01');
    const stream = run(events); await expect(stream.committed).rejects.toThrow('Invalid committed decision');
    expect(stream.onCommit).not.toHaveBeenCalled();
  });
  it('provider wait retains prior guidance and releases the read latch', async () => {
    const events = [{ schema: 'lab-analysis-stream/v2', request_id: 'wait', type: 'analysis_waiting', event_sequence: 1, retry_after_ms: 17000 }, { schema: 'lab-analysis-stream/v2', request_id: 'wait', type: 'stream_complete', event_sequence: 2 }];
    const stream = run(events);
    await expect(stream.committed).resolves.toEqual({ kind: 'waiting', retryAfterMs: 17000, analysisStatus: 'waiting_for_provider' }); await stream.completion;
    expect(stream.onCommit).not.toHaveBeenCalled();
  });
});
