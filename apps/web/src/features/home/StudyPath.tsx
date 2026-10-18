import { useSession } from '../../app/Session';
import { fieldName, languageName, selectedField } from '../../contracts/learning-preferences';
import { ActionLink, Card, Icon, PageTitle } from '../../ui/kit';
export function StudyPath({ home = false }: { home?: boolean }) {
  const { profile } = useSession();
  if (!profile) return null;
  return <div className="page-stack study-path"><PageTitle eyebrow="YOUR LEARNING SPACE" title={home ? `Hello, ${profile.displayName.split(' ')[0]}.` : 'Your subject, your learning path.'}>Your language and field shape how you learn.</PageTitle><Card><span className="eyebrow">YOUR PREFERENCES</span><h2>{fieldName(selectedField(profile)) || 'Choose your field of study'}</h2><p>{languageName(profile.supportLanguage)} · Language support {profile.dialLevel}/5</p><p>Your preferences are saved. The current teaching example covers Analog Communication for ECE, with Odia and English support. Lessons for this combination are not available in this demo yet.</p><div className="form-actions"><ActionLink to="/profile">Edit preferences<Icon name="tune" /></ActionLink><ActionLink variant="secondary" to="/library">Your Library<Icon name="folder_open" /></ActionLink></div></Card></div>;
}
