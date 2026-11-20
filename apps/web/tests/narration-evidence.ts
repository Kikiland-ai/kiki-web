import type { Page } from '@playwright/test';

type Playback = { starts: number[]; playing: boolean; time: number; peak: number };

export async function observeNarration(page: Page) {
  await page.evaluate(() => {
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    const buffers = new Map<AudioBuffer, number>();
    const starts: number[] = [];
    let active: AudioBufferSourceNode | null = null;
    let startedAt = 0;
    let peak = 0;
    const recordStart = (source: AudioBufferSourceNode) => {
      const buffer = source.buffer!;
      if (!buffers.has(buffer)) buffers.set(buffer, buffers.size + 1);
      starts.push(buffers.get(buffer)!);
      active = source;
      startedAt = source.context.currentTime;
      peak = buffer.getChannelData(0).reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
      source.addEventListener('ended', () => { if (active === source) active = null; }, { once: true });
    };
    AudioBufferSourceNode.prototype.start = function (...args) {
      start.apply(this, args);
      recordStart(this);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      stop.apply(this, args);
      if (active === this) active = null;
    };
    Object.assign(window, {
      narrationDiagnostic: (): Playback => ({
        starts, playing: active?.context.state === 'running',
        time: active ? active.context.currentTime - startedAt : 0, peak,
      }),
    });
  });
  return () => page.evaluate(() => (window as unknown as { narrationDiagnostic: () => Playback }).narrationDiagnostic());
}
