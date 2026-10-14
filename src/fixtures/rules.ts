import type { Id, LabReadiness, PointerBlockReason } from '../contracts'
import type { ConceptCheckRecord, StoredLabSession } from './store'

/**
 * Rules ported from Design-Thinking data-model/runtime/learning-case.js, so
 * fixture behaviour matches what the backend will compute.
 */

export const CONCEPT_CHECK_PASS_PERCENT = 60

/** scoreQuiz: pass when correct × 100 ≥ passPercent × total, never via a rounded percent. */
export function passes(correct: number, total: number, passPercent = CONCEPT_CHECK_PASS_PERCENT) {
  return total > 0 && correct * 100 >= passPercent * total
}

/** The latest run of one concept's check: newest completedAt, then the higher attempt number. */
export function latestCheck(records: ConceptCheckRecord[] | undefined): ConceptCheckRecord | undefined {
  let latest: ConceptCheckRecord | undefined
  for (const r of records ?? []) {
    const newer =
      !latest ||
      Date.parse(r.completedAt) > Date.parse(latest.completedAt) ||
      (Date.parse(r.completedAt) === Date.parse(latest.completedAt) && r.attemptNumber > latest.attemptNumber)
    if (newer) latest = r
  }
  return latest
}

/** requiredConceptReadiness: every required concept's latest check passed. The chapter test never gates the lab. */
export function requiredConceptReadiness(
  practicalId: Id,
  requiredConceptIds: Id[],
  checks: Record<Id, ConceptCheckRecord[]>,
): LabReadiness {
  const latest = new Map(requiredConceptIds.map((id) => [id, latestCheck(checks[id])]))
  const passed = (id: Id) => {
    const r = latest.get(id)
    return !!r && passes(r.correct, r.total)
  }
  return {
    practicalId,
    ready: requiredConceptIds.every(passed),
    requiredConceptIds,
    missingConceptIds: requiredConceptIds.filter((id) => !passed(id)),
    evidenceRunIds: requiredConceptIds.flatMap((id) => {
      const r = latest.get(id)
      return r ? [r.runId] : []
    }),
    chapterTestRequired: false,
  }
}

/**
 * pointerActivation, for the device asking. Reasons keep the runtime's
 * order; lease_expired is the contract's addition for a lapsed lease.
 */
export function pointerActivation(
  session: StoredLabSession,
  readiness: LabReadiness,
  deviceId: Id | undefined,
  now: number,
): { active: boolean; reasons: PointerBlockReason[] } {
  const reasons: PointerBlockReason[] = []
  if (!session.experimentSelected) reasons.push('experiment_not_selected')
  if (!readiness.ready) reasons.push('required_concepts_not_passed')
  if (!session.software.opened) reasons.push('software_not_opened')
  if (!session.software.workspaceConfirmed) reasons.push('workspace_not_confirmed')
  if (!session.connection.consentGranted) reasons.push('observation_not_enabled')
  if (session.connection.state !== 'active') reasons.push('connection_not_active')
  if (session.status !== 'active') reasons.push('session_not_active')
  const controller = session.control.controllingDeviceId
  if (!controller || (deviceId && controller !== deviceId)) reasons.push('no_controlling_device')
  else if (session.control.leaseExpiresAt && Date.parse(session.control.leaseExpiresAt) <= now) {
    reasons.push('lease_expired')
  }
  return { active: reasons.length === 0, reasons }
}
