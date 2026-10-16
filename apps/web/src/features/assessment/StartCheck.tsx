import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { readableError } from '../../services/types';
import { ActionLink, Alert, Button, PageTitle } from '../../ui/kit';

export function StartCheck() {
  const { assessmentId = '' } = useParams(); const [params] = useSearchParams(); const previousRunId = params.get('previousRunId') ?? undefined;
  const { profile, services } = useSession(); const navigate = useNavigate();
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController(); const keyName = `kiki:quiz:start:${profile.id}:${assessmentId}`;
    setError('');
    let key: string;
    try { key = sessionStorage.getItem(keyName) ?? crypto.randomUUID(); sessionStorage.setItem(keyName, key); }
    catch { setError('Your browser could not keep this check’s start request. Try again.'); return; }
    services.assessments.start(assessmentId, controller.signal, key, previousRunId).then(run => {
      if (controller.signal.aborted) return;
      if (run.ownerLearnerId !== profile.id || run.assessmentId !== assessmentId) throw new Error('Wrong assigned check.');
      sessionStorage.removeItem(keyName); navigate(`/assessments/${assessmentId}/${run.runId}`, { replace: true });
    }).catch(e => { if (!controller.signal.aborted) setError(readableError(e)); });
    return () => controller.abort();
  }, [profile, services, assessmentId, previousRunId, retry, navigate]);
  return <div className="page-stack"><PageTitle title={error ? 'This check couldn’t start.' : 'Opening your assigned questions…'} />{error && <Alert>{error}</Alert>}{error && <Button onClick={() => setRetry(n => n+1)}>Retry start</Button>}<ActionLink to="/practice" variant="secondary">Back to concept checks</ActionLink></div>;
}
