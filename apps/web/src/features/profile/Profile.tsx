import { useState } from 'react';
import { useSession } from '../../app/Session';
import { dialLabels, languageName, selectedField } from '../../contracts/learning-preferences';
import { LanguagePreference, StudyFieldPreference } from './PreferenceFields';
import { readableError } from '../../services/types';
import { Alert, Button, Card, Icon, PageTitle, Rating } from '../../ui/kit';
export function Profile() {
  const { profile, update, logout, services } = useSession();
  const [regional, setRegional] = useState(profile?.onboarding.fluencySelfRatings?.support.outOf10 ?? 5);
  const [english, setEnglish] = useState(profile?.onboarding.fluencySelfRatings?.englishOutOf10 ?? 5);
  const [language, setLanguage] = useState(profile?.supportLanguage ?? 'en');
  const [field, setField] = useState(profile ? selectedField(profile) : '');
  const [dial, setDial] = useState(profile?.dialLevel ?? 2);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  if (!profile) return null;
  const name = languageName(language), labels = dialLabels(language);
  return <div className="page-stack profile-refined"><PageTitle eyebrow="YOUR PREFERENCES" title="Make room for how you learn.">Your language, field and support. Your saved progress stays with you.</PageTitle><div className="profile-layout"><Card className="form-card"><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try { await update({ supportLanguage: language.trim(), studyField: field.trim(), dialLevel: dial, onboarding: { ...profile.onboarding, fluencySelfRatings: { support: { language: language.trim(), outOf10: regional }, englishOutOf10: english, assessedBy: 'self' } } }); setSaved(true); }
    catch (err) { setError(readableError(err)); } finally { setBusy(false); }
  }}><h2>Your learning context</h2><LanguagePreference id="profile-language" value={language} onChange={value => { setLanguage(value); setSaved(false); }} /><StudyFieldPreference id="profile-field" value={field} onChange={value => { setField(value); setSaved(false); }} /><div className="dial-control"><label htmlFor="profile-dial">Language support <strong>{dial}/5</strong></label><input id="profile-dial" type="range" min="1" max="5" step="1" value={dial} aria-valuetext={labels[dial - 1]} onChange={e => { setDial(Number(e.target.value)); setSaved(false); }} /><p>{labels[dial - 1]}</p></div><fieldset className="confidence-group"><legend>Your confidence</legend><p className="helper-note">Confidence is your own rating. It does not award concept, English or lab proficiency.</p><Rating label={language === 'en' ? 'Learning-language confidence (English)' : `${name} confidence`} value={regional} onChange={n => { setRegional(n); setSaved(false); }} /><Rating label="English confidence" value={english} onChange={n => { setEnglish(n); setSaved(false); }} /></fieldset><p className="helper-note">This demo’s prepared teaching path is ECE · Analog Communication, with Odia and English support. Other preferences can be saved as your learning context.</p>{error && <Alert>{error}</Alert>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}<Icon name="check" /></Button>{saved && <span role="status" className="save-confirmation">Preferences saved</span>}</div></form></Card><aside aria-label="Your account"><Card className="account-card"><span className="avatar">{profile.displayName[0]}</span><h2>{profile.displayName}</h2><p>{services.mode === 'fixture' ? 'Demo learner · Browser-only preview' : 'Signed in with Google'}</p>{services.mode === 'fixture' && <p>Aditya’s example journey starts with Odia and ECE. Kiki’s language and field preferences are yours to choose.</p>}<hr /><h3>On a shared computer?</h3><p>Sign out of Kiki when you finish. External learning tools have their own separate sign-out.</p><Button variant="secondary" disabled={busy} onClick={() => logout().catch(err => setError(readableError(err)))}>Sign out<Icon name="logout" /></Button></Card></aside></div></div>;
}
