/** Capture lifecycle for one owned preparation. Pixels are masked before JPEG encoding. */
import type { AuthService } from '../../contracts/services';
import type { ExecutionRequirements, FrameChannel, FrameReceipt, LabExecutionApi, LabExecutionState, ResponseKind } from '../../contracts/lab-execution';
import { readableError, ServiceError } from '../../services/types';
import { startAnalysisStream } from './analysis-stream';
import { createFloatingPublisher, type CaptureTrack, type FloatingPublisher } from './floating-bridge';
import { acceptedFrom, currentScope, observationAge, projectSnapshot, type AcceptedObservation } from './floating-guidance';

export type ConnectionPhase = 'loading' | 'ready' | 'connecting' | 'active' | 'paused' | 'disconnected' | 'completed' | 'unavailable';
export interface LabCaptureView {
  phase: ConnectionPhase; reason: string; state: LabExecutionState | null;
  extension: { present: boolean; bound: boolean; superseded: boolean }; preview: string | null;
  reading: boolean; retryAfterMs: number; snapshot: ReturnType<typeof projectSnapshot> | null;
  recovering: boolean; canRecover: boolean;
  inputBusy: boolean; requirements: ExecutionRequirements | null; requirementsError: string;
}
export class LabCaptureController {
  private phase: ConnectionPhase = 'loading';
  private reason = 'Checking your lab connection…';
  private state: LabExecutionState | null = null;
  private accepted: AcceptedObservation | null = null;
  private preview: string | null = null;
  private stream: MediaStream | null = null;
  private channel: FrameChannel | null = null;
  private publisher: FloatingPublisher;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private timer = 0;
  private heartbeat = 0;
  private sequence = 0;
  private started = 0;
  private size = '';
  private generation = 0;
  private commandBusy = false;
  private commandTail: Promise<void> = Promise.resolve();
  private queuedCommands = 0;
  private loadBusy = false;
  private canRecover = false;
  private inputBusy = false;
  private requirements: ExecutionRequirements | null = null;
  private requirementsError = '';
  private requirementsBusy = false;
  private disposed = false;
  private lifetime = new AbortController();
  private checkAbort: AbortController | null = null;
  private commandAbort: AbortController | null = null;
  private reading = false;
  private retryAt = 0;
  private lastHash: string | null = null;
  private lastCheckedAt = 0;
  private unregister: () => void;
  private listeners = new Set<(view: LabCaptureView) => void>();

  constructor(private prepId: string, private api: LabExecutionApi, auth: AuthService) {
    this.publisher = createFloatingPublisher({ targetOrigins: api.targetOrigins, onChange: () => {
      if (this.disposed) return;
      const extension = this.publisher.status();
      if (this.stream && (!extension.bound || extension.superseded)) this.stop('Kiki lost its MATLAB tab. Show Kiki there and share again.');
      this.emit();
    }, onCommand: command => this.command(command) });
    this.publisher.source(() => this.state ? { state: this.projectionState()!, accepted: this.accepted, ageMs: observationAge(this.accepted), reading: this.reading, retryAfterMs: Math.max(0, this.retryAt - Date.now()) } : null);
    this.unregister = auth.registerSignOutCleanup(() => {
      this.stop('Sign in again to reconnect your lab.'); this.lifetime.abort(); this.publisher.dispose();
    });
    window.addEventListener('pagehide', this.pagehide);
    this.heartbeat = window.setInterval(() => {
      void this.channel?.command('heartbeat').catch(() => this.stop('The lab connection ended. Share your MATLAB tab again.')); this.emit();
    }, 4000);
  }
  private pagehide = () => { this.stop('Lab mode closed. Share your MATLAB tab again to reconnect.'); this.publisher.dispose(); };
  private projectionState() {
    // A saved server state is not proof that this browser is still sharing.
    return this.state ? { ...this.state, runtime: { ...this.state.runtime, capture_active: Boolean(this.stream && ['active', 'paused'].includes(this.phase)) } } : null;
  }
  subscribe(listener: (view: LabCaptureView) => void) { this.listeners.add(listener); listener(this.view()); return () => { this.listeners.delete(listener); }; }
  view(): LabCaptureView {
    const retryAfterMs = Math.max(0, this.retryAt - Date.now());
    return { phase: this.phase, reason: this.reason, state: this.state, extension: this.publisher.status(), preview: this.preview, reading: this.reading, retryAfterMs, recovering: this.loadBusy, canRecover: this.canRecover, inputBusy: this.inputBusy, requirements: this.requirements, requirementsError: this.requirementsError,
      snapshot: this.state ? projectSnapshot(this.projectionState()!, { accepted: this.accepted, ageMs: observationAge(this.accepted), reading: this.reading, retryAfterMs, blockedReason: this.publisher.blockedReason() }) : null };
  }
  private emit() { if (!this.disposed) { const view = this.view(); this.listeners.forEach(listener => listener(view)); this.publisher.changed(); } }
  private adopt(state: LabExecutionState) {
    if (this.disposed || this.lifetime.signal.aborted || (this.state && (state.lab_session_id !== this.state.lab_session_id || state.revision < this.state.revision))) return;
    // Compact committed decisions omit immutable definition metadata and response history.
    // Retain the last full GET fields for this same lab until the next authoritative GET.
    this.state = { ...state, definition: state.definition ?? this.state?.definition, responses: state.responses ?? this.state?.responses };
    this.accepted = acceptedFrom(this.state, this.accepted); this.preview = null;
    if (!this.requirements && !this.requirementsBusy && !this.requirementsError) void this.loadRequirements();
    if (state.status === 'completed') { this.stop('This guided lab is complete.', 'completed'); }
    this.emit();
  }
  async load(recover = false) {
    if (this.loadBusy || this.disposed || this.lifetime.signal.aborted || this.stream) return;
    this.loadBusy = true; this.canRecover = false; this.emit();
    try {
      let state: LabExecutionState;
      try { state = await this.api.get(this.prepId, this.lifetime.signal); }
      catch (error) {
        if (!recover || !(error instanceof ServiceError) || error.status !== 503 || error.code !== 'lab_creation_pending' || this.disposed || this.lifetime.signal.aborted) throw error;
        // One explicit Retry, one replay POST. Key/body stay exclusively on the server.
        // Recovery never invokes the screen picker or creates a capture session.
        state = await this.api.recover(this.prepId, this.lifetime.signal);
      }
      if (this.disposed || this.lifetime.signal.aborted) return;
      this.adopt(state);
      if (state.status === 'completed') return;
      this.phase = 'disconnected'; this.reason = 'Your saved lab is ready. Share your MATLAB tab again to reconnect.';
    } catch (error) {
      if (this.lifetime.signal.aborted || this.disposed) return;
      this.phase = error instanceof ServiceError && error.status === 404 ? 'ready' : 'unavailable';
      this.canRecover = error instanceof ServiceError && error.status === 503 && error.code === 'lab_creation_pending';
      this.reason = this.phase === 'ready' ? 'Show Kiki on MATLAB, then choose that Chrome tab to start.' : readableError(error);
    } finally { this.loadBusy = false; this.emit(); }
  }
  recheckExtension() { this.publisher.recheck(); }
  async loadRequirements() {
    if (this.disposed || this.lifetime.signal.aborted || this.requirementsBusy) return;
    this.requirementsBusy = true; this.requirementsError = '';
    try {
      const value = await this.api.requirements(this.prepId, this.lifetime.signal);
      if (this.disposed || this.lifetime.signal.aborted) return;
      if (value.backendLabId !== this.state?.lab_session_id || value.definitionSha256 !== this.state.definition?.definition_sha256) throw new ServiceError('Lab instructions changed. Reopen the lab before recording input.');
      this.requirements = value;
    } catch (error) { if (!this.disposed && !this.lifetime.signal.aborted) this.requirementsError = readableError(error); }
    finally { this.requirementsBusy = false; this.emit(); }
  }
  async submitInput(scope: string, input: { kind: ResponseKind; text: string; self_confidence?: number } | { criterion_ids: string[]; review_note: string }) {
    if (!this.state || this.disposed || this.lifetime.signal.aborted || this.commandBusy || this.queuedCommands || this.inputBusy || this.state.status === 'completed') throw new ServiceError('Wait for the current lab action before submitting.');
    if (scope !== JSON.stringify(currentScope(this.state))) throw new ServiceError('The lab context changed. Your draft is kept for its original step.', 409);
    const current = this.requirements?.checkpoints.find(cp => cp.id === this.state!.queue.current_checkpoint_id);
    if (!current || this.requirements?.definitionSha256 !== this.state.definition?.definition_sha256) throw new ServiceError('Load the current lab input instructions before submitting.');
    const review = 'criterion_ids' in input;
    if (review && (input.criterion_ids.length < 1 || input.criterion_ids.length > 12 || new Set(input.criterion_ids).size !== input.criterion_ids.length || input.criterion_ids.some(id => !current.criteria.some(c => c.id === id)) || input.review_note.trim().length < 8 || input.review_note.trim().length > 1000)) throw new ServiceError('Select current criteria and describe your reviewed evidence in 8–1000 characters.', 422);
    if (!review && (!input.text.trim() || input.text.trim().length > 2000 || (input.self_confidence !== undefined && (!Number.isInteger(input.self_confidence) || input.self_confidence < 1 || input.self_confidence > 5)))) throw new ServiceError('Write your response in 1–2000 characters and use confidence 1–5 if supplied.', 422);
    if (review && (this.phase !== 'active' || this.view().snapshot?.screen_context.status !== 'fresh' || this.state.runtime.analysis_status !== 'available' || !this.state.runtime.candidate || this.state.workspace.condition !== current.condition)) throw new ServiceError('Resume sharing and obtain a fresh checked screen in this step’s expected condition before confirming.', 409);
    await this.mutateInput(scope, (revision, signal) => review ? this.api.review(this.prepId, { ...input, revision }, signal) : this.api.respond(this.prepId, { ...input, text: input.text.trim(), revision }, signal));
  }
  async declareCondition(scope: string) {
    const checkpoint = this.requirements?.checkpoints.find(cp => cp.id === this.state?.queue.current_checkpoint_id);
    if (!checkpoint || this.requirements?.definitionSha256 !== this.state?.definition?.definition_sha256) throw new ServiceError('Load the current lab instructions first.');
    await this.mutateInput(scope, (revision, signal) => this.api.context(this.prepId, { revision, action: 'condition', condition: checkpoint.condition }, signal));
  }
  private async mutateInput(scope: string, perform: (revision: number, signal: AbortSignal) => Promise<LabExecutionState>) {
    if (!this.state || this.disposed || this.lifetime.signal.aborted || this.commandBusy || this.queuedCommands || this.inputBusy || this.state.status === 'completed') throw new ServiceError('Wait for the current lab action before submitting.');
    if (scope !== JSON.stringify(currentScope(this.state))) throw new ServiceError('The lab context changed. Your draft is kept for its original step.', 409);
    this.inputBusy = true; this.commandBusy = true; this.cancelCheck(); this.emit();
    const controller = new AbortController(); this.commandAbort = controller;
    const signal = AbortSignal.any([controller.signal, this.lifetime.signal]);
    try {
      const revision = this.state.revision;
      const result = await perform(revision, signal);
      if (signal.aborted || this.disposed) throw new ServiceError('The lab input was interrupted. Reopen the saved lab to check whether it was received.');
      this.adopt(result);
    } catch (error) {
      if (!signal.aborted && error instanceof ServiceError && error.status === 409) {
        try { this.adopt(await this.api.get(this.prepId, signal)); } catch { /* keep draft and last committed state */ }
      }
      throw error;
    } finally {
      this.inputBusy = false;
      if (this.commandAbort === controller) { this.commandAbort = null; this.commandBusy = false; }
      this.emit();
    }
  }
  async share() {
    if (this.disposed || this.lifetime.signal.aborted || this.stream || this.phase === 'connecting') return;
    if (!this.publisher.status().bound || !window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
      this.reason = 'Use desktop Chrome and show Kiki on the MATLAB tab first.'; this.emit(); return;
    }
    const current = ++this.generation;
    this.phase = 'connecting'; this.reason = 'Choose the Chrome tab showing MATLAB, not a window or entire screen.'; this.emit();
    try {
      // This is deliberately the first awaited operation: keep the click's gesture.
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: false, video: { displaySurface: 'browser', frameRate: { ideal: 2, max: 5 } }, selfBrowserSurface: 'exclude' } as DisplayMediaStreamOptions);
      if (this.disposed || current !== this.generation || this.lifetime.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const track = stream.getVideoTracks()[0] as CaptureTrack;
      if (!track || track.getSettings().displaySurface !== 'browser') throw new ServiceError('Choose the Chrome tab showing MATLAB. Whole-window and screen capture are not supported.');
      track.addEventListener('ended', () => { if (this.current(current)) this.stop('Screen sharing stopped. Share your MATLAB tab again to reconnect.'); }, { once: true });
      track.addEventListener('capturehandlechange', () => {
        // Chromium can publish the initial, correct handle after play() starts.
        // An event from an older capture must never stop a fresh Share gesture.
        if (this.current(current) && !this.publisher.matchesTarget(track)) this.stop('The shared tab changed or reloaded. Show Kiki on MATLAB, then share again.');
      });
      this.video = document.createElement('video'); this.video.muted = true; this.video.playsInline = true; this.video.srcObject = stream;
      await this.video.play();
      if (!this.current(current)) return;
      const safety = this.publisher.sampleSafety(track, this.video.videoWidth, this.video.videoHeight);
      if (safety.mode === 'block' && safety.reason.includes('same Chrome tab')) throw new ServiceError(safety.reason);
      if (!this.state) this.adopt(await this.api.start(this.prepId, this.lifetime.signal));
      if (!this.current(current) || !this.state || this.state.status === 'completed') return;
      const capture = await this.api.screen(this.prepId, this.lifetime.signal);
      if (!this.current(current)) return;
      const channel = await this.api.channel(this.prepId, capture.session_id, () => {
        if (this.current(current)) this.stop('The lab connection ended. Share your MATLAB tab again to reconnect.');
      }, this.lifetime.signal);
      if (!this.current(current)) { channel.close(); return; }
      this.channel = channel; await channel.ready;
      if (!this.current(current)) return;
      // Python only attaches a receiver which has acknowledged active sharing.
      await channel.command('capture_started');
      if (!this.current(current)) return;
      this.adopt(await this.api.get(this.prepId, this.lifetime.signal));
      this.adopt(await this.api.attach(this.prepId, this.state.revision, capture.session_id, this.lifetime.signal));
      if (!this.current(current)) return;
      if (this.state.status === 'paused') this.adopt(await this.api.context(this.prepId, { revision: this.state.revision, action: 'resume' }, this.lifetime.signal));
      if (!this.current(current)) return;
      this.started = performance.now(); this.sequence = 0; this.size = ''; this.lastHash = null;
      this.phase = 'active'; this.reason = 'Sharing active. Waiting for the first safe screen read.'; this.emit(); void this.tick(current);
    } catch (error) {
      if (current !== this.generation || this.disposed) return;
      this.stop(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Sharing was cancelled. Choose Share your MATLAB tab when you are ready.' : readableError(error));
    }
  }
  private current(generation: number) { return !this.disposed && generation === this.generation && !this.lifetime.signal.aborted && Boolean(this.stream); }
  private async tick(generation: number) {
    if (!this.current(generation)) return;
    try {
      if (this.phase !== 'active' || this.commandBusy || !this.video || !this.channel || !this.state) return;
      const width = this.video.videoWidth, height = this.video.videoHeight;
      if (!width || !height) return;
      const size = `${width}x${height}`;
      if (this.size && this.size !== size) {
        this.cancelCheck();
        const fresh = await this.api.get(this.prepId, this.lifetime.signal); this.adopt(fresh);
        if (!this.current(generation)) return;
        this.adopt(await this.api.context(this.prepId, { revision: fresh.revision, action: 'view_changed', view_revision: fresh.workspace.view_revision + 1 }, this.lifetime.signal));
      }
      this.size = size;
      if (!this.current(generation)) return;
      const scale = Math.min(1, 1600 / Math.max(width, height));
      const canvas = this.canvas ??= document.createElement('canvas');
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const context = canvas.getContext('2d'); if (!context) throw new ServiceError('This browser could not prepare the shared frame.');
      context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const safety = this.publisher.sampleSafety(this.stream!.getVideoTracks()[0] as CaptureTrack, canvas.width, canvas.height);
      this.publisher.apply(context, safety, canvas.width, canvas.height);
      if (safety.mode === 'block') {
        this.reason = safety.reason; this.emit();
        if (safety.reason.includes('same Chrome tab')) this.stop(safety.reason);
        return; // never encode, upload or analyse an unproven/unsafe sample
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new ServiceError('The shared frame could not be encoded.')), 'image/jpeg', 0.8));
      if (!this.current(generation) || this.phase !== 'active' || this.commandBusy) return;
      if (blob.size > 1_000_000) throw new ServiceError('The shared frame is too large. Reduce the MATLAB tab size and share again.');
      const frame = await this.channel.sendFrame({ type: 'frame', capture_epoch: 1, view_revision: this.state.workspace.view_revision, sequence: ++this.sequence, captured_elapsed_ms: Math.max(0, Math.round(performance.now() - this.started)),
        width: canvas.width, height: canvas.height, source_width: width, source_height: height, byte_count: blob.size, mime_type: 'image/jpeg' }, blob);
      // A skipped frame was not admitted, so there is nothing to check; the next tick resends.
      if (frame && this.current(generation)) void this.check(frame, generation);
    } catch (error) { if (this.current(generation)) this.stop(readableError(error)); }
    finally { if (this.current(generation)) this.timer = window.setTimeout(() => { void this.tick(generation); }, 2000); }
  }
  private async check(frame: FrameReceipt, generation: number) {
    if (!this.state || this.reading || this.phase !== 'active' || this.commandBusy || Date.now() < this.retryAt) return;
    const sameFrame = frame.sha256 === this.lastHash;
    const interval = sameFrame ? 12000 : 3000;
    if (Date.now() - this.lastCheckedAt < interval) return;
    this.reading = true; this.preview = null; this.lastCheckedAt = Date.now(); this.lastHash = frame.sha256;
    const controller = new AbortController(); this.checkAbort = controller;
    const signal = AbortSignal.any([controller.signal, this.lifetime.signal]);
    this.emit();
    try {
      // Refresh metadata before the check; previous frame receipt never grants a pass.
      const state = await this.api.get(this.prepId, signal);
      if (!this.current(generation) || signal.aborted || this.phase !== 'active') return;
      this.adopt(state);
      const response = await this.api.check(this.prepId, { revision: state.revision, frame_id: frame.frame_id, view_revision: frame.view_revision }, signal);
      const pipe = startAnalysisStream(response, { frame, context: currentScope(state), signal,
        onPreview: text => { if (this.current(generation) && !signal.aborted) { this.preview = text; this.emit(); } },
        onCommit: value => { if (this.current(generation) && !signal.aborted) { this.adopt(value); if (this.phase === 'active') this.reason = 'Sharing active. Guidance follows the committed screen read.'; } },
      });
      const outcome = await pipe.committed;
      if (this.current(generation) && !signal.aborted && outcome.kind === 'waiting') {
        // Transport status may change without replacing the last committed step.
        if (this.state) this.state = { ...this.state, runtime: { ...this.state.runtime, analysis_status: outcome.analysisStatus } };
        this.retryAt = Date.now() + outcome.retryAfterMs; this.reason = 'The screen reader is waiting. Your current guidance is kept.';
      }
      // Tail delivery may finish later. It can never overwrite committed guidance.
      void pipe.completion.catch(() => { if (this.current(generation) && !signal.aborted) { this.reason = 'Additional screen details were interrupted. Committed guidance is kept.'; this.emit(); } });
    } catch (error) {
      if (signal.aborted || !this.current(generation)) return;
      this.retryAt = Date.now() + 12000; this.reason = readableError(error);
      if (error instanceof ServiceError && error.status === 409) {
        try { this.adopt(await this.api.get(this.prepId, this.lifetime.signal)); } catch { /* keep prior guidance */ }
      }
    } finally { if (this.checkAbort === controller) { this.checkAbort = null; this.reading = false; this.preview = null; this.emit(); } }
  }
  private cancelCheck() { this.checkAbort?.abort(); this.checkAbort = null; this.reading = false; this.preview = null; }
  // A paused snapshot can enable the floating Resume before Pause's final GET
  // finishes. Keep both surfaces in order and fence the queue to this capture.
  command(action: 'pause' | 'resume'): Promise<void> {
    if (this.inputBusy) return Promise.reject(new ServiceError('Wait for the current lab action before changing sharing.'));
    const generation = this.generation;
    ++this.queuedCommands;
    const run = this.commandTail.catch(() => undefined).then(async () => {
      if (!this.current(generation)) throw new ServiceError('Share your MATLAB tab from Lab mode first.');
      await this.performCommand(action);
    }).finally(() => { if (generation === this.generation) --this.queuedCommands; });
    this.commandTail = run;
    return run;
  }
  private async performCommand(action: 'pause' | 'resume') {
    if (!this.state || !this.stream || !this.channel || this.commandBusy) throw new ServiceError('Share your MATLAB tab from Lab mode first.');
    if ((action === 'pause' && this.phase === 'paused') || (action === 'resume' && this.phase === 'active')) return;
    const generation = this.generation, channel = this.channel;
    const controller = new AbortController(); this.commandAbort = controller;
    const signal = AbortSignal.any([controller.signal, this.lifetime.signal]);
    this.commandBusy = true; this.cancelCheck(); this.phase = 'paused'; this.reason = action === 'pause' ? 'Pausing the shared screen…' : 'Resuming the shared screen…'; this.emit();
    try {
      if (action === 'resume') await channel.command('resume');
      if (!this.current(generation)) return;
      const fresh = await this.api.get(this.prepId, signal);
      if (!this.current(generation)) return;
      this.adopt(fresh);
      const value = await this.api.context(this.prepId, { revision: this.state.revision, action }, signal);
      if (!this.current(generation)) return;
      this.adopt(value);
      if (action === 'pause') {
        await channel.command('pause');
        if (!this.current(generation)) return;
        const paused = await this.api.get(this.prepId, signal);
        if (!this.current(generation)) return;
        this.adopt(paused);
      }
      if (!this.current(generation)) return;
      this.phase = action === 'pause' ? 'paused' : 'active'; this.reason = action === 'pause' ? 'Paused. No new frames are sent.' : 'Sharing resumed. Waiting for the next safe frame.';
    } catch (error) {
      if (!this.current(generation) || signal.aborted) return;
      try {
        const latest = await this.api.get(this.prepId, signal);
        if (this.current(generation) && !signal.aborted) this.adopt(latest);
      } catch { /* preserve guidance */ }
      if (!this.current(generation)) return;
      this.stop(readableError(error)); throw error;
    } finally { if (this.commandAbort === controller) { this.commandAbort = null; this.commandBusy = false; this.emit(); } }
  }
  stop(reason = 'Sharing stopped. Share your MATLAB tab again to reconnect.', phase: ConnectionPhase = 'disconnected') {
    ++this.generation; this.commandTail = Promise.resolve(); this.queuedCommands = 0;
    clearTimeout(this.timer); this.cancelCheck(); this.commandAbort?.abort(); this.commandAbort = null; this.commandBusy = false;
    const stream = this.stream, channel = this.channel; this.stream = null; this.channel = null;
    stream?.getTracks().forEach(track => track.stop());
    if (this.video) { this.video.pause(); this.video.srcObject = null; this.video = null; }
    void channel?.command('stop').catch(() => undefined); channel?.close();
    this.phase = phase; this.reason = reason; this.emit();
  }
  dispose() {
    if (this.disposed) return;
    this.stop('Lab mode closed.'); this.disposed = true; this.lifetime.abort();
    clearInterval(this.heartbeat); window.removeEventListener('pagehide', this.pagehide); this.publisher.dispose(); this.unregister(); this.listeners.clear();
  }
}
