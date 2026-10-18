import { useEffect, useRef, useState } from 'react';
import type { AuthService } from '../../contracts/services';
import type { LabExecutionApi } from '../../contracts/lab-execution';
import { Button, Icon, LoadingNotice } from '../../ui/kit';
import { LabCaptureController, type LabCaptureView } from './lab-capture';
import { LabStudentInput } from './LabStudentInput';
import styles from './LabConnection.module.css';

export function LabConnection({ preparationId, api, auth }: { preparationId: string; api: LabExecutionApi; auth: AuthService }) {
  const controller = useRef<LabCaptureController | null>(null);
  const [view, setView] = useState<LabCaptureView | null>(null);
  useEffect(() => {
    const connection = new LabCaptureController(preparationId, api, auth);
    controller.current = connection;
    const unsubscribe = connection.subscribe(setView); void connection.load();
    return () => { unsubscribe(); connection.dispose(); if (controller.current === connection) controller.current = null; };
  }, [preparationId, api, auth]);
  if (!view) return <LoadingNotice>Opening lab connection…</LoadingNotice>;
  const active = view.phase === 'active', paused = view.phase === 'paused';
  const now = view.snapshot?.instructions.now, next = view.snapshot?.instructions.next;
  const phase = ({ loading: 'Checking connection', ready: 'Ready to share', connecting: 'Connecting', active: 'Sharing active', paused: 'Paused', disconnected: 'Disconnected', completed: 'Completed', unavailable: 'Connection unavailable' })[view.phase];
  return <section className={styles.panel} aria-label="Lab connection">
    <div className={styles.heading}><div><span className="eyebrow">YOUR MATLAB TAB · LAB MODE</span><h2>See the next step. Try it yourself.</h2></div><span className={styles.phase} data-state={view.phase}>{phase}</span></div>
    <p className={styles.status} role="status">{view.reason}</p>
    <p className={styles.boundary}>Screen reads guide the current action. They do not assess your practical proficiency. Your notes stay saved separately.</p>
    {!active && !paused && view.phase !== 'completed' && <ol className={styles.setup}>
      <li><span><strong>Open your experiment</strong><span>Use the Chrome tab where you will build your model.</span></span><a className="button button-secondary" href="https://matlab.mathworks.com/" target="_blank" rel="noopener noreferrer">Open MATLAB<Icon name="open_in_new" /></a></li>
      <li><span><strong>Show Kiki on MATLAB</strong><span>{view.extension.bound ? 'Kiki is bound to your MATLAB tab.' : view.extension.present ? 'On MATLAB, open the Kiki windows extension and choose “Show Kiki on this tab”. Return here when it is shown.' : 'Use the local Kiki windows extension supplied by your team, reload Lab mode, then show Kiki on your MATLAB tab.'}</span></span><Button variant="secondary" onClick={() => controller.current?.recheckExtension()}>Check Kiki extension<Icon name="refresh" /></Button></li>
      <li><span><strong>Share that Chrome tab</strong><span>Choose the same tab in the picker. Kiki’s windows are masked from the screen read.</span></span><Button disabled={!view.extension.bound || ['loading', 'connecting', 'unavailable'].includes(view.phase)} onClick={() => void controller.current?.share()}>Share your MATLAB tab<Icon name="screen_share" /></Button></li>
    </ol>}
    {view.phase === 'unavailable' && <Button variant="secondary" disabled={view.recovering} onClick={() => void controller.current?.load(true)}>{view.recovering ? 'Checking saved lab…' : view.canRecover ? 'Recover saved lab' : 'Retry connection'}<Icon name="refresh" /></Button>}
    {(active || paused) && <div className={styles.actions}><Button onClick={() => { void controller.current?.command(paused ? 'resume' : 'pause').catch(() => undefined); }}>{paused ? 'Resume sharing' : 'Pause sharing'}<Icon name={paused ? 'play_arrow' : 'pause'} /></Button><Button variant="secondary" onClick={() => controller.current?.stop()}>Stop sharing<Icon name="stop" /></Button><span>{view.reading ? 'Reading a safe frame…' : view.retryAfterMs > 0 ? `Next read in about ${Math.ceil(view.retryAfterMs / 1000)} seconds` : 'Only the selected tab is shared.'}</span></div>}
    {view.state && <div className={styles.guidance}>
      <div><span className="eyebrow">NOW · {view.state.queue.current_checkpoint_id ?? 'COMPLETE'}</span><h3 data-testid="execution-now">{now?.title ?? 'This guided lab is complete.'}</h3>{now?.where && <p>{now.where}</p>}{now?.how.length ? <ul>{now.how.map((line, i) => <li key={i}>{line}</li>)}</ul> : null}{now?.settings.length ? <dl>{now.settings.map((setting, i) => <div key={i}><dt>{setting.field}</dt><dd>{setting.value}</dd></div>)}</dl> : null}{now?.expected_result && <p><strong>Look for: </strong>{now.expected_result}</p>}</div>
      <aside><span className="eyebrow">COMING NEXT</span><p data-testid="execution-next">{next?.title ?? 'No further action in this guide.'}</p>{view.snapshot?.instructions.why && <p>{view.snapshot.instructions.why}</p>}<small>{view.state.queue.done_checkpoint_ids.length}/12 stages tracked · screen-inferred progress</small>{view.snapshot?.screen_context.summary && <div className={styles.observation}><strong>{view.snapshot.screen_context.status === 'fresh' ? 'Current screen read' : 'Earlier screen read'}</strong><p>{view.snapshot.screen_context.summary}</p></div>}</aside>
    </div>}
    {view.preview && <div className={styles.preview} role="status"><strong>Tentative screen check</strong><p>{view.preview}</p><small>Finishing verification before updating guidance.</small></div>}
    {view.state && view.phase !== 'completed' && <LabStudentInput key={preparationId} view={view} submitInput={(scope, input) => controller.current ? controller.current.submitInput(scope, input) : Promise.reject(new Error('Lab connection closed.'))} declareCondition={scope => controller.current ? controller.current.declareCondition(scope) : Promise.reject(new Error('Lab connection closed.'))} retryRequirements={() => void controller.current?.loadRequirements()} />}
    {view.phase === 'completed' && <p>Keep your model in MATLAB and your preparation notes here. This guide does not issue an assessment result.</p>}
  </section>;
}
