/**
 * Gemini Live over a WebSocket, as KiKi's voice only. Protocol verified against the live
 * service (constrained endpoint + locked ephemeral token). The tutoring system answers
 * every submit_reply; this client never decides anything.
 */
export const LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

export type VoiceBrief = { mode: 'scripted' | 'guided'; lang: 'en' | 'or'; say: string; expectsReply: boolean; goal?: string; mustNotReveal?: string[]; studentSaid?: string | null };

export interface LiveEvents {
  ready(): void
  audio(pcm24k: Int16Array): void
  kikiText(textSoFar: string): void            // cumulative transcript of KiKi's current turn
  studentText(textSoFar: string): void         // cumulative transcript of the student's speech
  reply(heardText: string, lang: string): Promise<VoiceBrief>   // tutoring system decides
  turnDone(kikiSaid: string): void
  interrupted(): void
  closed(reason: string, recoverable: boolean): void
  goAway?(): void                              // the server will close soon: reconnect with the handle
}

/** The subset of Live server messages KiKi reads (verified against the service). */
type ServerMessage = {
  setupComplete?: object
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean }
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] }
    inputTranscription?: { text?: string }
    outputTranscription?: { text?: string }
    interrupted?: boolean
    turnComplete?: boolean
  }
  toolCall?: { functionCalls?: { id: string; name: string; args?: { heard_text?: string; lang?: string } }[] }
  goAway?: { timeLeft?: string }
};

type SocketLike = Pick<WebSocket, 'send' | 'close' | 'readyState'> & {
  onopen: ((e: Event) => void) | null; onmessage: ((e: MessageEvent) => void) | null;
  onclose: ((e: CloseEvent) => void) | null; onerror: ((e: Event) => void) | null;
};

export function b64ToInt16(b64: string): Int16Array {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, bytes.length >> 1);
}

export function int16ToB64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class LiveVoice {
  private ws: SocketLike | null = null;
  private kiki = '';
  private student = '';
  private resumeHandle: string | null = null;
  private closedByUs = false;

  constructor(private events: LiveEvents, private makeSocket: (url: string) => SocketLike = (u) => new WebSocket(u) as unknown as SocketLike) {}

  get handle() { return this.resumeHandle; }

  connect(token: string, model: string, resumeHandle?: string | null) {
    this.closedByUs = false;
    const ws = this.makeSocket(`${LIVE_URL}?access_token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => {
      const setup: Record<string, unknown> = { model: `models/${model}` };
      if (resumeHandle) setup.sessionResumption = { handle: resumeHandle };
      ws.send(JSON.stringify({ setup }));
    };
    ws.onmessage = (e) => { void this.onMessage(e.data); };
    ws.onerror = () => { /* onclose follows with the reason */ };
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      if (!this.closedByUs) this.events.closed(e.reason || `closed (${e.code})`, !!this.resumeHandle && e.code !== 1008);
    };
  }

  /** Speak a brief the tutoring system produced (opening line, or after voice is switched on). */
  speak(brief: VoiceBrief) {
    this.kiki = '';
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'BRIEF ' + JSON.stringify(brief) }] }], turnComplete: true } });
  }

  sendAudio(pcm16k: Int16Array) {
    this.send({ realtimeInput: { audio: { data: int16ToB64(pcm16k), mimeType: 'audio/pcm;rate=16000' } } });
  }

  sendText(text: string) {
    this.send({ realtimeInput: { text } });
  }

  close() {
    this.closedByUs = true;
    this.ws?.close();
    this.ws = null;
  }

  private send(msg: unknown) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  private async onMessage(data: unknown) {
    const text = typeof data === 'string' ? data : data instanceof Blob ? await data.text() : new TextDecoder().decode(data as ArrayBuffer);
    let m: ServerMessage;
    try { m = JSON.parse(text) as ServerMessage; } catch { return; }
    if (m.setupComplete) this.events.ready();
    if (m.goAway) this.events.goAway?.();
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) this.resumeHandle = m.sessionResumptionUpdate.newHandle;
    const sc = m.serverContent;
    if (sc) {
      for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) this.events.audio(b64ToInt16(p.inlineData.data));
      if (sc.inputTranscription?.text) { this.student += sc.inputTranscription.text; this.events.studentText(this.student); }
      if (sc.outputTranscription?.text) { this.kiki += sc.outputTranscription.text; this.events.kikiText(this.kiki); }
      if (sc.interrupted) this.events.interrupted();
      if (sc.turnComplete) { const said = this.kiki; this.kiki = ''; this.events.turnDone(said); }
    }
    for (const fc of m.toolCall?.functionCalls ?? []) {
      if (fc.name !== 'submit_reply') continue;
      const heard = String(fc.args?.heard_text ?? this.student).trim();
      this.student = '';
      this.kiki = '';
      const brief = await this.events.reply(heard, String(fc.args?.lang ?? 'en'));
      this.send({ toolResponse: { functionResponses: [{ id: fc.id, name: fc.name, response: { brief } }] } });
    }
  }
}
