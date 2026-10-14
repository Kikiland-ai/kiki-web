import type { LabSessionStatus, PointerBlockReason } from '../../contracts'

/** Each session status in plain words, with what the student can do about it (Phase 7: every inactive state shows a reason and a recovery). */
export const STATUS_COPY: Record<LabSessionStatus, { label: string; tone: 'neutral' | 'success' | 'not_yet'; detail: string }> = {
  preparing: {
    label: 'Preparing',
    tone: 'not_yet',
    detail: 'Some concept checks the lab needs are still to pass. You can read the steps and plan now.',
  },
  ready: {
    label: 'Ready to connect',
    tone: 'neutral',
    detail: 'All seven concept checks have passed. Open Simulink Online to start building.',
  },
  connecting: {
    label: 'Connecting',
    tone: 'neutral',
    detail: 'Open your DSB-SC model in Simulink Online and confirm it here.',
  },
  active: { label: 'In progress', tone: 'success', detail: 'Work through the steps below. Your progress is saved after each one.' },
  paused: { label: 'Paused', tone: 'not_yet', detail: 'Your place is saved. Resume when you are ready.' },
  disconnected: {
    label: 'Not connected',
    tone: 'not_yet',
    detail: 'The connection to Simulink stopped. Your finished steps are saved; reconnect to carry on.',
  },
  completed: { label: 'Finished', tone: 'success', detail: 'This lab is finished. Your steps and observations are saved.' },
}

/**
 * Without the extension the server never reaches "active" (no connection),
 * so once Simulink is set up the Manual guide is simply in progress.
 */
export const MANUAL_IN_PROGRESS = {
  label: 'In progress',
  tone: 'success' as const,
  detail: 'Work through the written steps below. Each tick is saved as your own report.',
}

/** Why Kiki's pointer is off, in plain words (contract §8: the UI shows pointer.reasons when inactive). */
export const POINTER_REASON: Record<PointerBlockReason, string> = {
  experiment_not_selected: 'No experiment is selected yet.',
  required_concepts_not_passed: 'Some required concept checks have not passed yet.',
  software_not_opened: 'Simulink Online is not open yet.',
  workspace_not_confirmed: 'Your DSB-SC model is not confirmed yet.',
  observation_not_enabled: 'Kiki has not been allowed to watch the Simulink tab.',
  connection_not_active: 'The Kiki extension is not connected.',
  session_not_active: 'The lab session is not running.',
  no_controlling_device: 'This device is not the one running the lab.',
  lease_expired: "This device's control lapsed.",
}
