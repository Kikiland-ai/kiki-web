import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { clearReturn, destination, hasReturn, rememberReturn } from '../../app/navigation';
import { ModeNotice } from '../../app/Shell';
import { COURSE, suggestedDial, type Profile, type ProfileUpdate } from '../../contracts/profile';
import { demoPathAvailable, dialLabels, languageName, selectedField } from '../../contracts/learning-preferences';
import { LanguagePreference, StudyFieldPreference } from '../profile/PreferenceFields';
import { readableError } from '../../services/types';
import { Alert, Button, Card, Icon, KikiDots, Wordmark } from '../../ui/kit';
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
  const [language, setLanguage] = useState(initial.supportLanguage);
  const [field, setField] = useState(selectedField(initial));
  const [preference, setPreference] = useState<Preference>(initial.onboarding.easyLanguageAnswer ?? 'regional');
  const [dial, setDial] = useState(initial.dialLevel);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const name = languageName(language), labels = dialLabels(language);
  const example = language === 'or' && field === 'ECE';
  // One screen: language, field and starting balance. Confidence ratings are optional and live in Profile.
  async function finish() {
    if (!language.trim() || !field.trim()) { setError('Choose your learning language and field of study.'); return; }
    setBusy(true); setError('');
    try {
      await update({ supportLanguage: language.trim(), studyField: field.trim(), dialLevel: dial, onboarding: {
        step: 3, completedAt: new Date().toISOString(),
        fluencySelfRatings: initial.onboarding.fluencySelfRatings?.support.language === language.trim() ? initial.onboarding.fluencySelfRatings : null,
        easyLanguageAnswer: preference,
      } });
      // With no saved destination, a student on the prepared path opens the chapter map first:
      // every concept in order, with "Continue learning" pointing at Concept 01
      const chapterMap = demoPathAvailable({ ...initial, supportLanguage: language.trim(), studyField: field.trim() }) ? `/chapters/${COURSE.chapterId}` : '/home';
      const target = hasReturn() ? destination() : chapterMap; clearReturn(); navigate(target, { replace: true });
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
  return <div className="public-page setup-refined"><header className="public-header"><Link to="/" aria-label="Kiki welcome"><Wordmark /></Link><Button variant="text" disabled={busy} onClick={() => { logout().catch(e => setError(readableError(e))); }}>Sign out<Icon name="logout" /></Button></header><ModeNotice /><main className="onboarding-layout"><aside className="setup-aside"><span className="eyebrow">MAKE KIKI YOURS</span><h1>Learning starts<br />with feeling<br /><span className="concept-text">comfortable.</span></h1><p>Your language. Your field.<br />Your starting point.</p><div className="setup-note"><KikiDots /><span>These are your preferences.<br />There are no right answers. Change them anytime in Profile.</span></div></aside><Card className="setup-card"><div className="step-caption">ONE QUICK STEP<span>Then your chapter</span></div><form onSubmit={e => { e.preventDefault(); void finish(); }}>
    <h2>What language feels comfortable?</h2><p>Tell us which language helps you understand ideas, and what you study.</p><LanguagePreference value={language} onChange={setLanguage} /><StudyFieldPreference value={field} onChange={setField} />{sample && <p className="helper-note">Meet Aditya in this demo: an ECE student comfortable in Odia. His starting preferences are filled in; you can change either.</p>}
    <h2 className="setup-subheading">How much English feels easy?</h2><p>Choose a starting balance. Only you change it.</p><fieldset className="sentence-choices"><legend className="sr-only">Starting language preference</legend>{choices.map(choice => <label key={choice.value} className={preference === choice.value ? 'selected' : ''}><input type="radio" name="preference" value={choice.value} checked={preference === choice.value} onChange={() => { setPreference(choice.value); setDial(suggestedDial(choice.value)); }} /><span><strong>{choice.label}</strong><span className="sentence-example">{choice.sentence}</span></span></label>)}</fieldset><details className="dial-fine-tune"><summary>Fine-tune your starting support · {dial}/5</summary><div className="dial-control"><label htmlFor="support-dial">Your starting support <strong>{dial}/5</strong></label><input id="support-dial" type="range" min="1" max="5" step="1" value={dial} aria-valuetext={labels[dial - 1]} onChange={e => setDial(Number(e.target.value))} /><div className="range-ends"><span>{language === 'en' ? 'More explanation' : `More ${name}`}</span><span>{language === 'en' ? 'Less support' : 'More English'}</span></div><p>{labels[dial - 1]}</p></div></details>
    {error && <Alert>{error}</Alert>}<div className="setup-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Start learning'}<Icon name="arrow_forward" /></Button></div></form></Card></main></div>;
}
