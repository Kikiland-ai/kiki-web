import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { clearReturn, destination, rememberReturn } from '../../app/navigation';
import { ModeNotice } from '../../app/Shell';
import { suggestedDial, type Profile, type ProfileUpdate } from '../../contracts/profile';
import { dialLabels, fieldName, languageName, selectedField } from '../../contracts/learning-preferences';
import { LanguagePreference, StudyFieldPreference } from '../profile/PreferenceFields';
import { readableError } from '../../services/types';
import { Alert, Button, Card, Icon, KikiDots, ProgressSteps, Rating, Wordmark } from '../../ui/kit';
const steps = ['Your context', 'Comfort', 'Support', 'Confirm'];
type Preference = 'regional' | 'mixed' | 'english';
export function Onboarding() {
  const { profile, update, logout, services } = useSession();
  const [params] = useSearchParams(); const returnTo = params.get('returnTo');
  useEffect(() => { if (returnTo) rememberReturn(returnTo); }, [returnTo]);
  if (!profile) return null;
  return <OnboardingForm key={profile.id} initial={profile} update={update} logout={logout} sample={services.mode === 'fixture'} />;
}
function OnboardingForm({ initial, update, logout, sample }: { initial: Profile; update(body: ProfileUpdate): Promise<void>; logout(): Promise<void>; sample: boolean }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(initial.onboarding.step);
  const [language, setLanguage] = useState(initial.supportLanguage);
  const [field, setField] = useState(selectedField(initial));
  const [regional, setRegional] = useState(initial.onboarding.fluencySelfRatings?.support.outOf10 ?? 5);
  const [english, setEnglish] = useState(initial.onboarding.fluencySelfRatings?.englishOutOf10 ?? 5);
  const [preference, setPreference] = useState<Preference>(initial.onboarding.easyLanguageAnswer ?? 'regional');
  const [dial, setDial] = useState(initial.dialLevel);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null), previousStep = useRef(step);
  useEffect(() => { if (previousStep.current !== step) { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); } previousStep.current = step; }, [step]);
  const odia = language === 'or', name = languageName(language), labels = dialLabels(language);
  const example = odia && field === 'ECE';
  async function advance(nextStep: number, complete = false) {
    if (!language.trim() || !field.trim()) { setError('Choose your learning language and field of study.'); setStep(0); return; }
    setBusy(true); setError('');
    try {
      await update({ supportLanguage: language.trim(), studyField: field.trim(), dialLevel: dial, onboarding: {
        step: nextStep, completedAt: complete ? new Date().toISOString() : null,
        fluencySelfRatings: step >= 1 ? { support: { language: language.trim(), outOf10: regional }, englishOutOf10: english, assessedBy: 'self' } : null,
        easyLanguageAnswer: step >= 2 ? preference : null,
      } });
      if (complete) { const target = destination(); clearReturn(); navigate(target, { replace: true }); } else setStep(nextStep);
    } catch (e) { setError(readableError(e)); } finally { setBusy(false); }
  }
  const choices = language === 'en' ? [
    { value: 'regional', label: 'English with extra explanations', sentence: 'Start with the idea and explain technical terms as we go.' },
    { value: 'mixed', label: 'A balance of explanation and technical terms', sentence: 'Link each technical term to the idea behind it.' },
    { value: 'english', label: 'English with less support', sentence: 'Keep explanations concise and let me explore the terms.' },
  ] as const : [
    { value: 'regional', label: `${name} explanation + English terms`, sentence: example ? <span lang="or">Carrier ସଙ୍କେତ message କୁ ବହନ କରେ।</span> : `Build understanding in ${name}, keeping technical terms in English.` },
    { value: 'mixed', label: `A mix of ${name} and English`, sentence: example ? <span lang="or">The Carrier ସଙ୍କେତ carries the message.</span> : `Use ${name} and English together for explanations.` },
    { value: 'english', label: `Mostly English, with ${name} help`, sentence: example ? 'The carrier signal carries the message.' : `Start in English and use ${name} when you need support.` },
  ] as const;
  return <div className="public-page setup-refined"><header className="public-header"><Link to="/" aria-label="Kiki welcome"><Wordmark /></Link><Button variant="text" disabled={busy} onClick={() => { logout().catch(e => setError(readableError(e))); }}>Sign out<Icon name="logout" /></Button></header><ModeNotice /><main className="onboarding-layout"><aside className="setup-aside"><span className="eyebrow">MAKE KIKI YOURS</span><h1>Learning starts<br />with feeling<br /><span className="concept-text">comfortable.</span></h1><p>Your language. Your field.<br />Your starting point.</p><ProgressSteps step={step} labels={steps} /><div className="setup-note"><KikiDots /><span>These are your preferences.<br />There are no right answers.</span></div></aside><Card className="setup-card"><div className="step-caption">STEP {step + 1} OF 4<span>Your context · Your learning language</span></div><form onSubmit={e => { e.preventDefault(); void advance(Math.min(step + 1, 3), step === 3); }}>
    {step === 0 && <><h2 ref={heading} tabIndex={-1}>What language feels comfortable?</h2><p>Tell us which language helps you understand ideas, and what you study.</p><LanguagePreference value={language} onChange={setLanguage} /><StudyFieldPreference value={field} onChange={setField} />{sample && <p className="helper-note">Meet Aditya in this demo: an ECE student comfortable in Odia. His starting preferences are filled in; you can change either.</p>}</>}
    {step === 1 && <><h2 ref={heading} tabIndex={-1}>How comfortable do you feel?</h2>{odia && <p lang="or" className="odia">ଓଡ଼ିଆ ଓ ଇଂରାଜୀରେ ଆପଣ କେତେ ସହଜ ଅନୁଭବ କରୁଛନ୍ତି?</p>}<p>Your own confidence, from 1 to 10. This is not a test of your proficiency.</p><Rating label={language === 'en' ? 'Learning-language confidence (English)' : `${name} confidence`} value={regional} onChange={setRegional} helper={`Understanding ideas in ${name}`} /><Rating label="English confidence" value={english} onChange={setEnglish} helper="Reading and explaining technical ideas in English" /></>}
    {step === 2 && <><h2 ref={heading} tabIndex={-1}>How much English feels easy?</h2><p>Choose a starting balance. Only you change it.</p><fieldset className="sentence-choices"><legend className="sr-only">Starting language preference</legend>{choices.map(choice => <label key={choice.value} className={preference === choice.value ? 'selected' : ''}><input type="radio" name="preference" value={choice.value} checked={preference === choice.value} onChange={() => { setPreference(choice.value); setDial(suggestedDial(choice.value)); }} /><span><strong>{choice.label}</strong><span className="sentence-example">{choice.sentence}</span></span></label>)}</fieldset><div className="dial-control"><label htmlFor="support-dial">Your starting support <strong>{dial}/5</strong></label><input id="support-dial" type="range" min="1" max="5" step="1" value={dial} aria-valuetext={labels[dial - 1]} onChange={e => setDial(Number(e.target.value))} /><div className="range-ends"><span>{language === 'en' ? 'More explanation' : `More ${name}`}</span><span>{language === 'en' ? 'Less support' : 'More English'}</span></div><p>{labels[dial - 1]}</p></div></>}
    {step === 3 && <><div className="confirm-symbol"><Icon name="check" /></div><h2 ref={heading} tabIndex={-1}>A learning space that fits you.</h2><p>Check your preferences before we begin.</p><dl className="summary-list"><div><dt>Learning language</dt><dd>{name}</dd></div><div><dt>Field of study / branch</dt><dd>{fieldName(field)}</dd></div><div><dt>{name} confidence</dt><dd>{regional}/10</dd></div><div><dt>English confidence</dt><dd>{english}/10</dd></div><div><dt>Starting support</dt><dd>{dial}/5 · {labels[dial - 1]}</dd></div></dl><div className="quiet-note"><Icon name="tune" /><span>You can change these preferences anytime in Profile. This demo’s prepared lessons cover ECE with Odia and English support.</span></div></>}
    {error && <Alert>{error}</Alert>}<div className="setup-actions">{step > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setStep(s => s - 1); setError(''); }}><Icon name="arrow_back" />Back</Button>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : step === 3 ? 'Go to my home' : 'Save and continue'}<Icon name="arrow_forward" /></Button></div></form></Card></main></div>;
}
