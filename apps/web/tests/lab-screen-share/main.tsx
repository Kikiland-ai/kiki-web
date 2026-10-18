/** Test entry only; unreachable from the production entry/build. */
import { createRoot } from 'react-dom/client';
import { App, createAppRouter } from '../../src/app/App';
import { createFixtureServices } from '../../src/fixtures/services';
import { createLabPreparationApi } from '../../src/services/lab-preparation-http';
import { createLabExecutionApi } from '../../src/services/lab-execution-http';
import '../../src/ui/styles.css';
import '../../src/ui/sketchbook.css';
import '../../src/ui/account-material.css';
import '../../src/ui/feedback.css';
const services = createFixtureServices();
const auth = { ...services.auth, getIdToken: async () => 'isolated-lab-test-token' };
services.auth = auth;
services.labPreparation = createLabPreparationApi('http://127.0.0.1:8002', auth);
services.labExecution = { ...createLabExecutionApi('http://127.0.0.1:8002', auth), targetOrigins: ['http://localhost:8871'] };
// Route refreshes must keep this isolated entry, never turn on a runtime auth bypass.
const prefix = '/tests/lab-screen-share/index.html';
const route = sessionStorage.getItem('isolated-lab-route') ?? '/auth';
if (location.pathname === prefix) history.replaceState(null, '', route);
setInterval(() => sessionStorage.setItem('isolated-lab-route', location.pathname), 200);
createRoot(document.getElementById('root')!).render(<App router={createAppRouter(services)} />);
