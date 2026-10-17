import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, createAppRouter } from './app/App';
import { createServices } from './services/create-services';
import { readableError } from './services/types';
import { Button, StateScreen } from './ui/kit';
import './ui/styles.css';
import './ui/sketchbook.css';

const root = createRoot(document.getElementById('root')!);
root.render(<StateScreen title="Opening Kiki…" />);
let startupDeadline: number;
const deadline = new Promise<never>((_, reject) => { startupDeadline = window.setTimeout(() => reject(new Error('Startup timeout')), 15000); });
Promise.race([createServices(), deadline]).then(services => root.render(<StrictMode><App router={createAppRouter(services)} /></StrictMode>)).catch(error => {
  root.render(<StateScreen title="Kiki needs its connection set up." action={<Button onClick={() => window.location.reload()}>Retry connection</Button>}>{readableError(error)}</StateScreen>);
}).finally(() => window.clearTimeout(startupDeadline));
