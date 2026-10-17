import { useSession } from '../../app/Session';
import { ActionLink, Alert, Button, Card, PageTitle } from '../../ui/kit';

// Development-only connection review; never creates a substitute learner profile.
export function ConnectionCheck() {
  const { services, identity, profile, status, error, retry, logout } = useSession();
  return <main className="state-screen"><div className="page-stack"><PageTitle eyebrow="DEVELOPMENT CONNECTION CHECK" title="Check your Kiki connection.">This page separates account sign-in from loading your learning profile.</PageTitle>
    <Card><h2>{services.mode === 'fixture' ? 'Sample identity only' : identity ? 'Firebase sign-in connected' : 'Firebase sign-in not completed'}</h2><p>{identity ? `Signed in as ${identity.displayName}.` : status === 'checking' ? 'Checking the current account…' : 'Use the normal Google sign-in screen.'}</p><p>{profile ? 'Python profile loaded and matched to this account.' : identity ? 'No Python learning profile is loaded yet. Authentication alone does not connect Library or learning data.' : 'The learning profile loads after sign-in.'}</p>{services.mode === 'fixture' && <p>This sample mode does not test Firebase or Python.</p>}</Card>
    {error && <Alert>{error}</Alert>}<div className="form-actions"><ActionLink to="/auth">Open sign-in screen</ActionLink><Button variant="secondary" disabled={status === 'checking' || status === 'loading'} onClick={retry}>Retry connection</Button>{identity && <Button variant="secondary" onClick={() => logout().catch(() => undefined)}>Sign out</Button>}{profile && <ActionLink variant="secondary" to="/home">Open Kiki</ActionLink>}</div>
    <p>Tokens and private keys are never displayed here. A live Google sign-in still needs the provider and this app address configured in Firebase.</p></div></main>;
}
