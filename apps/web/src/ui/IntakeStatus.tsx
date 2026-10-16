import type { IntakeRequest } from '../contracts/intake';
import { Icon } from './kit';
export const STAGE_LABELS = { stored: 'Saved in Library', reading: 'Reading material', needs_review: 'Needs your review', generating: 'Preparing lessons', ready: 'Ready', failed: 'Needs attention' } as const;
export function IntakeStatus({ status }: { status: IntakeRequest['status'] }) {
  return <span className="status-pill"><Icon name={status === 'failed' ? 'info' : status === 'ready' ? 'check' : 'description'} />{STAGE_LABELS[status]}</span>;
}
