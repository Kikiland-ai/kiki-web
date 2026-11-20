/** Isolated local acceptance, never imported by the app/production build. */
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation,useNavigate} from 'react-router';
import {PhysicalExperiment} from '../../src/features/labs/physical/PhysicalLab';
import {createPhysicalLabApi} from '../../src/services/physical-lab-http';
import type {AuthService} from '../../src/contracts/services';
import '../../src/ui/styles.css';
import '../../src/ui/sketchbook.css';
import '../../src/ui/feedback.css';
const api=createPhysicalLabApi('http://127.0.0.1:8092',{getIdToken:async()=> 'physical-preview'} as AuthService);
function Preview(){const location=useLocation(),navigate=useNavigate(),id=new URLSearchParams(location.search).get('session')??undefined;return <main style={{maxWidth:1500,margin:'auto',padding:24}}><p>Local synthetic acceptance · Real physical experiment engine · No Google account or college records</p><PhysicalExperiment key={id||'new'} api={api} sessionId={id} language="en" onSession={session=>navigate('?session='+session,{replace:true})}/></main>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Preview/></BrowserRouter>);
