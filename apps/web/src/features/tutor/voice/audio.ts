/** Microphone → 16 kHz PCM chunks, and 24 kHz PCM → speaker, for the Live voice. */

const WORKLET = `
class KikiMic extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.ratio = sampleRate / 16000; this.pos = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // linear-interpolated downsample to 16 kHz
    while (this.pos < ch.length - 1) {
      const i = Math.floor(this.pos), f = this.pos - i;
      const s = ch[i] * (1 - f) + ch[i + 1] * f;
      this.buf.push(Math.max(-1, Math.min(1, s)) * 0x7fff);
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    if (this.buf.length >= 1600) {               // 100 ms at 16 kHz
      this.port.postMessage(Int16Array.from(this.buf));
      this.buf = [];
    }
    return true;
  }
}
registerProcessor('kiki-mic', KikiMic);
`;

export function downsampleTo16k(input: Float32Array, rate: number): Int16Array {
  const ratio = rate / 16000, n = Math.floor(input.length / ratio), out = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    const pos = k * ratio, i = Math.floor(pos), f = pos - i;
    const s = input[i] * (1 - f) + (input[Math.min(i + 1, input.length - 1)] ?? 0) * f;
    out[k] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  return out;
}

export async function startMic(onChunk: (pcm: Int16Array) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'kiki-mic');
  node.port.onmessage = (e) => onChunk(e.data as Int16Array);
  src.connect(node);
  let muted = false;
  return {
    setMuted(m: boolean) { muted = m; stream.getAudioTracks().forEach(t => { t.enabled = !m; }); },
    get muted() { return muted; },
    async stop() { node.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); await ctx.close(); },
  };
}

/** Gapless playback of 24 kHz chunks; `flush()` stops at once (barge-in). */
export function createPlayer(onIdle: () => void = () => {}) {
  const ctx = new AudioContext({ sampleRate: 24000 });
  let at = 0;
  const playing = new Set<AudioBufferSourceNode>();
  return {
    play(pcm: Int16Array) {
      if (ctx.state === 'suspended') void ctx.resume();
      const buf = ctx.createBuffer(1, pcm.length, 24000), ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination);
      at = Math.max(at, ctx.currentTime + 0.02);
      src.start(at); at += buf.duration;
      playing.add(src);
      src.onended = () => { playing.delete(src); if (!playing.size) onIdle(); };
    },
    flush() { playing.forEach(s => { try { s.stop(); } catch { /* already stopped */ } }); playing.clear(); at = 0; },
    get busy() { return playing.size > 0; },
    async close() { this.flush(); await ctx.close(); },
  };
}
