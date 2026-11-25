import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, createAppRouter } from './app/App';
import { createServices } from './services/create-services';
import { readableError } from './services/types';
import { Button, StateScreen } from './ui/kit';
import { observeLegacyAnnouncements } from './features/extension/extension-status';
import './ui/styles.css';
import './ui/sketchbook.css';
import './ui/account-material.css';
import './ui/feedback.css';

// Listen before async auth; active probes start only in the signed-in Shell.
const stopLegacyObserver = observeLegacyAnnouncements();
if (import.meta.hot) import.meta.hot.dispose(stopLegacyObserver);

const root = createRoot(document.getElementById('root')!);
root.render(<StateScreen busy title="Opening KiKi…" />);
let startupDeadline: number;
const deadline = new Promise<never>((_, reject) => { startupDeadline = window.setTimeout(() => reject(new Error('Startup timeout')), 15000); });
Promise.race([createServices(), deadline]).then(services => root.render(<StrictMode><App router={createAppRouter(services)} /></StrictMode>)).catch(error => {
  root.render(<StateScreen title="KiKi needs its connection set up." action={<Button onClick={() => window.location.reload()}>Retry connection</Button>}>{readableError(error)}</StateScreen>);
}).finally(() => window.clearTimeout(startupDeadline));
