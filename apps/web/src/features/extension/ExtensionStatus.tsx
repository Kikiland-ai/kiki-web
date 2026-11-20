import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../ui/kit';
import { canPrepareExtension, prepareExtensionFolder } from './prepare-extension';
import { watchExtension, type ExtensionState } from './extension-status';

const labels = { checking: 'Checking Lab extension', current: 'Lab extension is up to date', missing: 'Lab extension not detected — install or enable', outdated: 'Lab extension update required', unknown: 'Could not check the latest Lab extension version' };
export function ExtensionStatus() {
  const [state, setState] = useState<ExtensionState>({ kind: 'checking', installed: null, latest: null });
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const needsAction = state.kind === 'missing' || state.kind === 'outdated';
  async function prepare() {
    if (preparing) return;
    setPreparing(true); setSetupMessage('');
    try { await prepareExtensionFolder(); setSetupMessage('Files ready. Open chrome://extensions and load this folder, or press Reload on your existing Kiki extension.'); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setSetupMessage(error instanceof Error ? error.message : 'Could not prepare the folder. Retry the same folder or use the ZIP download.'); }
    finally { setPreparing(false); }
  }
  async function copyAddress() {
    try { await navigator.clipboard.writeText('chrome://extensions'); setSetupMessage('Address copied. Paste it into the address bar of a new Chrome tab.'); }
    catch { setSetupMessage('Open a new Chrome tab and type chrome://extensions in the address bar.'); }
  }
  const id = useId(), root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const watcher = useRef<ReturnType<typeof watchExtension> | null>(null);
  useEffect(() => { watcher.current = watchExtension(setState); return () => { watcher.current?.dispose(); watcher.current = null; }; }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="extension-status" ref={root}>
    <button ref={button} type="button" className={`extension-status-button extension-${state.kind}`} title={labels[state.kind]} aria-label={labels[state.kind]} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><Icon name={state.kind === 'current' ? 'check_circle' : state.kind === 'checking' ? 'refresh' : 'extension'} />{needsAction && <><span className="extension-action-label">{state.kind === 'missing' ? 'Install' : 'Update'}</span><span className="extension-alert-badge" aria-hidden="true">!</span></>}</button>
    <span className="sr-only" role="status">{labels[state.kind]}</span>
    {open && <section id={id} className="extension-status-panel" aria-label="Lab extension setup">
      <strong>{labels[state.kind]}</strong>
      <p>{state.installed ? `Installed: ${state.installed}.` : 'Kiki checks this browser profile. Use desktop Chrome and allow the extension on Kiki.'} {state.latest && `Latest: ${state.latest}.`}</p>
      {setupMessage && <p role="status">{setupMessage}</p>}
      {state.kind === 'current' ? <p>Your Lab extension is ready. No installation needed.</p> : <>
        <p>{canPrepareExtension() ? 'Let Kiki download and extract the files into a folder you choose. For updates, choose your existing Kiki extension folder.' : 'Download the ZIP and extract it into a permanent folder. For updates, replace the files in your existing Kiki extension folder.'} Chrome asks you to approve loading the extension.</p>
        {canPrepareExtension() && <button type="button" className="button button-primary" disabled={preparing} onClick={() => { void prepare(); }}>{preparing ? 'Preparing files…' : 'Prepare extension folder'}<Icon name="folder_open" /></button>}
        <a className="button button-secondary" href="/lab-extension/kiki-lab-extension.zip" download>Download latest extension<Icon name="download" /></a>
        <ol><li>{canPrepareExtension() ? 'Prepare an empty permanent folder above, or download and extract the ZIP yourself.' : 'Download and extract the ZIP into a permanent folder.'}</li><li>Open <code>chrome://extensions</code> and turn on Developer mode.</li><li>First install: choose <strong>Load unpacked</strong> and select that folder. Updating: prepare your existing extension folder above, then press <strong>Reload</strong> on its extension card. Do not load a second copy.</li><li>Return here and press <strong>Reload Kiki</strong> after installing, updating or enabling the extension.</li></ol>
        <div className="extension-setup-actions"><button type="button" className="button button-secondary" onClick={() => { void copyAddress(); }}>Copy extensions address</button><button type="button" className="button button-secondary" onClick={() => window.location.reload()}>Reload Kiki<Icon name="refresh" /></button></div>
      </>}
      <button type="button" className="button button-secondary" onClick={() => { void watcher.current?.check(); }}>Check again<Icon name="refresh" /></button>
    </section>}
  </div>;
}
