import type { LabSession } from '../../contracts'
import { Button, StatusBadge } from '../../ui'
import { CheckIcon } from '../../ui/icons'
import { DSB_SC } from './experiment'
import styles from './LabTrackerScreen.module.css'

export type ConnectPanelProps = {
  session: LabSession
  busy: boolean
  onOpened: () => void
  onModelConfirmed: () => void
  onReconnect: () => void
}

/**
 * Getting Simulink ready on this device. The student opens Simulink Online
 * and their model themselves; a browser link opening is not proof the model
 * opened, so each step is confirmed here. Without the Kiki extension there
 * is no pointer: the written Manual guide is used instead. With it, and only
 * while session.pointer.active, step 3 says the pointer is on.
 */
export function ConnectPanel({ session, busy, onOpened, onModelConfirmed, onReconnect }: ConnectPanelProps) {
  const opened = session.software.opened
  const confirmed = session.software.workspaceConfirmed

  return (
    <section className={styles.panel} aria-labelledby="connect-title">
      <h2 id="connect-title" className={styles.panelTitle}>
        Set up Simulink
      </h2>
      {session.status === 'disconnected' && (
        <div className={styles.reconnect}>
          <p>The connection stopped. Your finished steps are saved. Reopen your model, then carry on.</p>
          <Button variant="secondary" onClick={onReconnect} disabled={busy}>
            I've reopened my model
          </Button>
        </div>
      )}
      <ol className={styles.checklist}>
        <li className={opened ? styles.checked : undefined}>
          <span className={styles.checkMark} aria-hidden="true">
            {opened ? <CheckIcon size={16} /> : '1'}
          </span>
          <div className={styles.checkBody}>
            <p>
              Open {DSB_SC.software} in a new tab and sign in to MathWorks.
              {opened && <span className={styles.srOnly}> Done.</span>}
            </p>
            {!opened && (
              <div className={styles.row}>
                <a className={styles.external} href={DSB_SC.softwareUrl} target="_blank" rel="noreferrer">
                  Open {DSB_SC.software}
                  <span className={styles.srOnly}> (opens in a new tab)</span>
                </a>
                <Button variant="secondary" onClick={onOpened} disabled={busy}>
                  I've opened it
                </Button>
              </div>
            )}
          </div>
        </li>
        <li className={confirmed ? styles.checked : undefined}>
          <span className={styles.checkMark} aria-hidden="true">
            {confirmed ? <CheckIcon size={16} /> : '2'}
          </span>
          <div className={styles.checkBody}>
            <p>
              Open your DSB-SC model there and save it.
              {confirmed && <span className={styles.srOnly}> Done.</span>}
            </p>
            {opened && !confirmed && (
              <Button variant="secondary" onClick={onModelConfirmed} disabled={busy}>
                This is my saved DSB-SC model
              </Button>
            )}
          </div>
        </li>
        <li>
          <span className={styles.checkMark} aria-hidden="true">
            3
          </span>
          <div className={styles.checkBody}>
            {session.pointer.active ? (
              <>
                <p>Kiki's pointer is on in Simulink. It points; you do every step yourself.</p>
                <StatusBadge label="Kiki's pointer on" dimension="lab" />
              </>
            ) : (
              <>
                <p>
                  Kiki's pointer needs the Kiki extension in desktop Chrome. It isn't connected here, so follow the
                  written steps below.
                </p>
                <StatusBadge label="Manual guide" />
              </>
            )}
          </div>
        </li>
      </ol>
    </section>
  )
}
