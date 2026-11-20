import { createPlayer, startMic } from '../../src/features/tutor/voice/audio';
import { LiveVoice, type VoiceBrief } from '../../src/features/tutor/voice/live-client';

/** Records what happens so the Playwright spec can assert on it. */
const result = { ready: false, kikiAudioChunks: 0, kikiSaid: [] as string[], heard: '', heardLang: '', toolCalls: 0,
  studentCaption: '', micChunks: 0, errors: [] as string[], done: false, msToTool: 0 };
(window as unknown as { voiceResult: typeof result }).voiceResult = result;
const log = (s: string) => { document.getElementById('log')!.textContent += s + '\n'; };

const params = new URLSearchParams(location.search);
const token = params.get('token')!, model = params.get('model') ?? 'gemini-3.8-live';
const first: VoiceBrief = { mode: 'scripted', lang: 'en', say: 'At 60 degrees, do you get all of the message back, part of it, or none?', expectsReply: true };
const next: VoiceBrief = { mode: 'scripted', lang: 'en', say: 'Good. Now, how does the phase error change the output?', expectsReply: true };

const player = createPlayer();
let micStarted = 0;
const live = new LiveVoice({
  ready: () => { result.ready = true; log('ready'); live.speak(first); },
  audio: (pcm) => { result.kikiAudioChunks++; player.play(pcm); },
  kikiText: () => {},
  studentText: (t) => { result.studentCaption = t; },
  reply: async (heard, lang) => {
    result.toolCalls++; result.heard = heard; result.heardLang = lang; result.msToTool = Math.round(performance.now() - micStarted);
    log(`tool: ${heard} (${lang})`);
    return next;
  },
  turnDone: (said) => {
    if (said) result.kikiSaid.push(said);
    log(`kiki: ${said}`);
    if (result.toolCalls && said) { result.done = true; live.close(); }
  },
  interrupted: () => log('interrupted'),
  closed: (reason) => { result.errors.push(reason); log('closed ' + reason); },
});
live.connect(token, model);
// open the mic after KiKi's first line, as the app does once voice is on
const wait = setInterval(async () => {
  if (result.kikiSaid.length >= 1 && !micStarted) {
    clearInterval(wait);
    micStarted = performance.now();
    try { await startMic((pcm) => { result.micChunks++; live.sendAudio(pcm); }); log('mic on'); }
    catch (e) { result.errors.push(String(e)); }
  }
}, 100);
