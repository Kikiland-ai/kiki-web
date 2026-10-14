import type { SignOutCleanup } from '../../contracts'
import { DSB_SC } from './experiment'
import { deviceId, labApi } from './services'

/**
 * Sign-out cleanup for the lab (contract §8 and AuthService.signOut): if this
 * device controls the learner's active DSB-SC session, release it so another
 * device can take over at once instead of waiting for the lease to lapse.
 * Never throws: a failed release must not block sign-out, because the lease
 * also expires server-side.
 *
 * Register it once at app start, after the auth service exists:
 * `auth.registerSignOutCleanup(releaseLabOnSignOut)`.
 */
export const releaseLabOnSignOut: SignOutCleanup = async () => {
  try {
    const me = deviceId()
    const session = await labApi().getActive(DSB_SC.practicalId)
    if (!session || session.control.controllingDeviceId !== me) return
    await labApi().release(session.id, { deviceId: me, expectedRevision: session.revision })
  } catch {
    // The lease expires on its own
  }
}
