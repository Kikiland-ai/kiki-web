import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { clearReturn, destination, rememberReturn } from '../../app/navigation';
import { ModeNotice } from '../../app/Shell';
import { DIAL_LABELS, suggestedDial, type Profile, type ProfileUpdate } from '../../contracts/profile';
import { readableError } from '../../services/types';
import { Alert, Button, Card, Icon, KikiDots, ProgressSteps, Rating, Wordmark } from '../../ui/kit';

const steps = ['Language', 'Comfort', 'Support', 'Confirm'];
type Preference = 'regional' | 'mixed' | 'english';
export function Onboarding() {
  const { profile, update, logout } = useSession();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');
  useEffect(() => { if (returnTo) rememberReturn(returnTo); }, [returnTo]);
  if (!profile) return null;
  return <OnboardingForm key={profile.id} initial={profile} update={update} logout={logout} />;
}
function OnboardingForm({ initial, update, logout }: { initial: Profile; update(body: ProfileUpdate): Promise<void>; logout(): Promise<void> }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(initial.onboarding.step);
  const [language, setLanguage] = useState(initial.supportLanguage);
  const [regional, setRegional] = useState(initial.onboarding.fluencySelfRatings?.support.outOf10 ?? 5);
  const [english, setEnglish] = useState(initial.onboarding.fluencySelfRatings?.englishOutOf10 ?? 5);
  const [preference, setPreference] = useState<Preference>(initial.onboarding.easyLanguageAnswer ?? 'regional');
  const [dial, setDial] = useState(initial.dialLevel);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const odia = language === 'or';
  const advance = async (nextStep: number, complete = false) => {
    setBusy(true); setError('');
    try {
      await update({ supportLanguage: language, dialLevel: dial, onboarding: {
        step: nextStep, completedAt: complete ? new Date().toISOString() : null,
        fluencySelfRatings: step >= 1 ? { support: { language, outOf10: regional }, englishOutOf10: english, assessedBy: 'self' } : null,
        easyLanguageAnswer: step >= 2 ? preference : null,
      } });
      if (complete) { const target = destination(); clearReturn(); navigate(target, { replace: true }); } else setStep(nextStep);
    } catch (e) { setError(readableError(e)); } finally { setBusy(false); }
  };
  return <div className="public-page"><header className="public-header"><Link to="/" aria-label="Kiki welcome"><Wordmark /></Link><Button variant="text" disabled={busy} onClick={() => { logout().catch(e => setError(readableError(e))); }}>Sign out<Icon name="logout" /></Button></header><ModeNotice /><main className="onboarding-layout"><aside className="setup-aside"><span className="eyebrow">MAKE KIKI YOURS</span><h1>Learning starts<br />with feeling<br /><span className="concept-text">comfortable.</span></h1><p>Tell Kiki what works for you.<br />You can change it anytime.</p><ProgressSteps step={step} labels={steps} /><div className="setup-note"><KikiDots /><span>These are your preferences.<br />There are no right answers.</span></div></aside><Card className="setup-card"><div className="step-caption">STEP {step + 1} OF 4<span>English interface · Your learning language</span></div><form onSubmit={e => { e.preventDefault(); advance(Math.min(step + 1, 3), step === 3); }}>
    {step === 0 && <><h2>What language feels comfortable?</h2><p>We’ll explain concepts in your chosen language and keep English technical terms alongside.</p><div className="language-options"><label className={odia ? 'selected' : ''}><input type="radio" name="language" value="or" checked={odia} onChange={() => setLanguage('or')} /><span lang="or">ଓଡ଼ିଆ</span><strong>Odia</strong><small>English terms stay in English.</small><Icon name="check_circle" /></label><label className={!odia ? 'selected' : ''}><input type="radio" name="language" value="en" checked={!odia} onChange={() => setLanguage('en')} /><span>Aa</span><strong>English</strong><small>Odia help remains available.</small><Icon name="check_circle" /></label></div><p className="helper-note">Starting with Odia and English for this chapter.</p></>}
    {step === 1 && <><h2>How comfortable do you feel?</h2>{odia && <p lang="or" className="odia">ଓଡ଼ିଆ ଓ ଇଂରାଜୀରେ ଆପଣ କେତେ ସହଜ ଅନୁଭବ କରୁଛନ୍ତି?</p>}<p>Your own confidence, from 1 to 10. This is not a test of your proficiency.</p><Rating label={odia ? 'Odia confidence' : 'Learning-language confidence (English)'} value={regional} onChange={setRegional} helper={odia ? <span lang="or">ଓଡ଼ିଆରେ ଶିଖିବା</span> : 'Understanding your learning language'} /><Rating label="English confidence" value={english} onChange={setEnglish} helper={odia ? <span lang="or">ଇଂରାଜୀରେ ପଢ଼ିବା ଓ ବୁଝିବା</span> : 'Reading and explaining technical ideas in English'} /></>}
    {step === 2 && <><h2>How much English feels easy?</h2>{odia && <p lang="or" className="odia">କେଉଁ ଭାଷାରେ ବୁଝିବା ଆପଣଙ୍କ ପାଇଁ ସହଜ?</p>}<p>Choose a starting balance. Only you change it.</p><fieldset className="sentence-choices"><legend className="sr-only">Starting language preference</legend>{([{ value: 'regional', label: 'Odia explanation + English terms', sentence: <span lang="or">Carrier ସଙ୍କେତ message କୁ ବହନ କରେ।</span> }, { value: 'mixed', label: 'A mix of Odia and English', sentence: <span lang="or">The Carrier ସଙ୍କେତ carries the message.</span> }, { value: 'english', label: 'Mostly English, with Odia help', sentence: 'The carrier signal carries the message.' }] as const).map(choice => <label key={choice.value} className={preference === choice.value ? 'selected' : ''}><input type="radio" name="preference" value={choice.value} checked={preference === choice.value} onChange={() => { setPreference(choice.value); setDial(suggestedDial(choice.value)); }} /><span><strong>{choice.label}</strong><span className="sentence-example">{choice.sentence}</span></span></label>)}</fieldset><div className="dial-control"><label htmlFor="support-dial">Your starting support <strong>{dial}/5</strong></label><input id="support-dial" type="range" min="1" max="5" step="1" value={dial} aria-valuetext={DIAL_LABELS[dial - 1]} onChange={e => setDial(Number(e.target.value))} /><div className="range-ends"><span>More Odia</span><span>More English</span></div><p>{DIAL_LABELS[dial - 1]}</p></div></>}
    {step === 3 && <><div className="confirm-symbol"><Icon name="check" /></div><h2>A learning space that fits you.</h2>{odia && <p lang="or" className="odia">ଆପଣଙ୍କ ପସନ୍ଦ ଅନୁଯାୟୀ ଶିଖିବା ଆରମ୍ଭ କରନ୍ତୁ।</p>}<p>Check your preferences before we begin.</p><dl className="summary-list"><div><dt>Learning language</dt><dd>{odia ? 'Odia · ଓଡ଼ିଆ' : 'English'}</dd></div><div><dt>{odia ? 'Odia' : 'Learning-language'} confidence</dt><dd>{regional}/10</dd></div><div><dt>English confidence</dt><dd>{english}/10</dd></div><div><dt>Starting support</dt><dd>{dial}/5 · {DIAL_LABELS[dial - 1]}</dd></div></dl><div className="quiet-note"><Icon name="tune" /><span>English navigation. Your chosen language for explanations. Change your preferences anytime in Profile.</span></div></>}
    {error && <Alert>{error}</Alert>}<div className="setup-actions">{step > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setStep(s => s - 1); setError(''); }}><Icon name="arrow_back" />Back</Button>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : step === 3 ? 'Go to my home' : 'Save and continue'}<Icon name="arrow_forward" /></Button></div><small className="saved-note" role="status">{busy ? 'Saving your preferences…' : 'Each completed step is saved so you can return.'}</small></form></Card></main></div>;
}
