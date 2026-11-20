import type { LabExecutionState } from '../../contracts/lab-execution';
import type { LabNarrationApi, LabNarrationClip, LabNarrationManifest } from '../../contracts/lab-narration';
import { narrationStepKey } from './floating-guidance';

type Cue = { key: string; clip: LabNarrationClip };
type CueSelection = { key: string | null; clip?: LabNarrationClip };
export type NarrationControl = 'narration_toggle' | 'narration_replay';
export type NarrationOverlay = { muted: boolean; replay: boolean };

export class StepNarrationPlayer<Manifest extends {revision: string}, State> {
  private manifest: Manifest | null = null;
  private request: AbortController | null = null;
  private audio: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private playing: AudioBufferSourceNode | null = null;
  private clipRequest: AbortController | null = null;
  private cue: Cue | null = null;
  private lastKey: string | null = null;
  private handled = false;
  private displayed = false;
  private muted = false;
  private error = '';

  constructor(private scopeId: string, private api: LabNarrationApi<Manifest>, private changed: () => void,
    private resolve: (state: State | null, manifest: Manifest | null) => CueSelection,
    private makeAudio = () => new AudioContext()) {}

  view() {
    return { enabled: this.manifest !== null, loading: this.request !== null, muted: this.muted,
      error: this.error, replay: this.displayed && this.cue !== null,
      playing: this.playing !== null, clipLoading: this.clipRequest !== null };
  }

  overlay(): NarrationOverlay | undefined {
    return this.manifest ? { muted: this.muted, replay: Boolean(this.cue) && !this.muted } : undefined;
  }

  async toggle() {
    if (this.request) return;
    if (this.manifest) {
      this.muted = !this.muted;
      if (this.muted) this.halt();
      else this.replay();
      this.changed();
      return;
    }
    const request = new AbortController();
    this.request = request;
    this.error = '';
    if (!this.resumeAudio()) {
      this.request = null;
      this.changed();
      return;
    }
    this.changed();
    try {
      const manifest = await this.api.manifest(this.scopeId, request.signal);
      if (!request.signal.aborted) this.manifest = manifest;
    } catch {
      if (!request.signal.aborted) this.error = 'Narration is unavailable. You can still follow the written steps.';
    } finally {
      if (this.request === request) {
        this.request = null;
        this.changed();
      }
    }
  }

  sync(state: State | null) {
    const {key, clip} = this.resolve(state, this.manifest);
    if (key !== null && key !== this.lastKey) {
      this.lastKey = key;
      this.handled = false;
    }
    if ((key && clip ? key : null) === (this.cue?.key ?? null)) return;
    this.halt();
    this.buffer = null;
    this.displayed = false;
    this.cue = key && clip ? { key, clip } : null;
    if (this.manifest) this.error = '';
  }

  shown(state: State) {
    if (!this.cue || this.cue.key !== this.resolve(state, this.manifest).key) return;
    const firstDisplay = !this.displayed;
    this.displayed = true;
    if (!this.handled && !this.muted) this.play();
    if (firstDisplay) this.changed();
  }

  replay() {
    if (!this.muted && this.resumeAudio()) this.play();
  }

  private resumeAudio() {
    // This runs before any network await in the reader's Enable or Replay click.
    // A later step may arrive while the MATLAB tab has focus.
    try {
      const audio = this.audio ??= this.makeAudio();
      if (audio.state !== 'running') void audio.resume().then(() => {
        if (this.audio === audio && this.buffer && !this.playing && !this.muted && this.displayed) this.startAudio();
      }).catch(() => {
        if (this.audio !== audio) return;
        this.error = 'Audio output is unavailable. Select Replay narration in this tab to retry.';
        this.changed();
      });
      return true;
    } catch {
      this.error = 'Audio output is unavailable in this browser.';
      return false;
    }
  }

  private play() {
    if (!this.cue || !this.displayed || this.muted || !this.manifest || this.clipRequest) return;
    this.handled = true;
    this.error = '';
    if (this.buffer) {
      this.startAudio();
      return;
    }
    const audio = this.audio;
    if (!audio) return;
    const request = new AbortController();
    this.clipRequest = request;
    this.changed();
    void this.api.clip(this.scopeId, this.manifest.revision, this.cue.clip, request.signal).then(async media => {
      try {
        request.signal.throwIfAborted();
        const blob = await fetch(media.url, { signal: request.signal });
        const buffer = await audio.decodeAudioData(await blob.arrayBuffer());
        if (request.signal.aborted) return;
        this.buffer = buffer;
        this.startAudio();
      } finally {
        media.release();
      }
    }).catch(() => {
      if (!request.signal.aborted) this.error = 'This step’s recording is unavailable. Use Replay to try again.';
    }).finally(() => {
      if (this.clipRequest === request) {
        this.clipRequest = null;
        this.changed();
      }
    });
  }

  private startAudio() {
    const audio = this.audio;
    if (!audio || !this.buffer) return;
    if (audio.state !== 'running') {
      this.error = 'Select Replay narration in the KiKi lab tab to turn sound on.';
      this.changed();
      return;
    }
    this.stopAudio();
    const source = audio.createBufferSource();
    source.buffer = this.buffer;
    source.connect(audio.destination);
    this.playing = source;
    source.onended = () => {
      if (this.playing !== source) return;
      this.playing = null;
      source.disconnect();
      this.changed();
    };
    try {
      source.start();
      this.error = '';
    } catch {
      this.playing = null;
      source.disconnect();
      this.error = 'This recording could not play. Use Replay to try again.';
    }
    this.changed();
  }

  private stopAudio() {
    if (!this.playing) return;
    this.playing.onended = null;
    this.playing.stop();
    this.playing.disconnect();
    this.playing = null;
  }

  private halt() {
    this.clipRequest?.abort();
    this.clipRequest = null;
    this.stopAudio();
  }

  dispose() {
    this.request?.abort();
    this.request = null;
    this.sync(null);
    if (this.audio) void this.audio.close().catch(() => {});
    this.audio = null;
  }
}

export class LabNarrationPlayer extends StepNarrationPlayer<LabNarrationManifest, LabExecutionState> {
  constructor(prepId: string, api: LabNarrationApi, changed: () => void, makeAudio?: () => AudioContext) {
    super(prepId, api, changed, (state, manifest) => {
      const key = narrationStepKey(state);
      const action = state?.guidance.current_action;
      const clip = action && !action.verification_only && manifest && state?.experiment_id === manifest.experimentId
        && state.guidance.procedure_version === manifest.procedureVersion ? manifest.clips[action.id] : undefined;
      return {key, clip};
    }, makeAudio);
  }
}
