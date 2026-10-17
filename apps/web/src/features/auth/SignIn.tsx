import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { destination, rememberReturn, safeReturn } from '../../app/navigation';
import { ModeNotice } from '../../app/Shell';
import { onboardingComplete } from '../../contracts/profile';
import { readableError } from '../../services/types';
import { Alert, Button, Icon, KikiDots, Wordmark } from '../../ui/kit';

function GoogleMark() { return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.5l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.7-3.6-11.3-8.4H5.9v5.3A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.7 27.9a12.2 12.2 0 0 1 0-7.8v-5.3H5.9a20 20 0 0 0 0 18.4l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.7c3 0 5.7 1 7.8 3l5.8-5.8A19.5 19.5 0 0 0 24 4 20.4 20.4 0 0 0 5.9 14.8l6.8 5.3c1.6-4.8 6-8.4 11.3-8.4Z"/></svg>; }
export function SignIn() {
  const { services, profile, status } = useSession();
  const [params] = useSearchParams();
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const returnTo = params.get('returnTo');
  useEffect(() => { if (returnTo) rememberReturn(safeReturn(returnTo)); }, [returnTo]);
  const signIn = async (redirect = false) => {
    setBusy(true); setError('');
    try { await services.auth.signIn({ remember, redirect }); } catch (e) { setError(readableError(e)); } finally { setBusy(false); }
  };
  if (profile) return <Navigate to={onboardingComplete(profile) ? (returnTo ? safeReturn(returnTo) : destination()) : '/onboarding'} replace />;
  const fixture = services.mode === 'fixture';
  return <div className="public-page auth-refined"><header className="public-header"><Link to="/" aria-label="Kiki welcome"><Wordmark /></Link><Link to="/" className="plain-link"><Icon name="arrow_back" />Back</Link></header><ModeNotice /><main className="auth-layout"><section className="auth-intro"><KikiDots size={64} /><span className="eyebrow">A PLACE TO MAKE IT CLICK</span><h1>Your learning.<br /> Your language.</h1><p>From today’s notes to tomorrow’s lab.<br />Pick up where you left off.</p><div className="auth-promise"><Icon name="lock" /><span>Your material and progress belong to your account.</span></div></section><section className="auth-card card"><span className="eyebrow">WELCOME TO KIKI</span><h2>Let’s get you started.</h2><p>New here or coming back?<br />Use the same Google sign-in.</p><fieldset className="device-choice"><legend>Is this a shared computer?</legend><label><input type="radio" name="device" checked={!remember} onChange={() => setRemember(false)} />Yes, or don’t remember me<span>Keep this sign-in for this browser session.</span></label><label><input type="radio" name="device" checked={remember} onChange={() => setRemember(true)} />No, this is my personal device<span>Remember my Google sign-in here.</span></label></fieldset>{error && <Alert>{error}</Alert>}<Button className="google-button" disabled={fixture || busy || status === 'loading'} onClick={() => signIn()}><GoogleMark />{busy ? 'Signing in…' : 'Sign in with Google'}</Button>{!fixture && <Button variant="text" disabled={busy} onClick={() => signIn(true)}>Use Google redirect instead<Icon name="open_in_new" /></Button>}{fixture && <div className="fixture-entry"><p>Google sign-in is available in connected mode. You can explore this preview with a sample student.</p><Button disabled={busy} onClick={() => signIn()}>Open sample student<Icon name="arrow_forward" /></Button></div>}<p className="auth-footnote">You’ll choose your learning language next. No password to create in Kiki.</p></section></main></div>;
}
