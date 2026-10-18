import { LearningContinuation } from './LearningContinuation';
import { ResumeLab } from '../labs/ResumeLab';
import { useState } from 'react';
import { useSession } from '../../app/Session';
import { COURSE } from '../../contracts/profile';
import { demoPathAvailable, fieldName, selectedField, languageName } from '../../contracts/learning-preferences';
import { StudyPath } from './StudyPath';
import { useAssessmentState } from '../assessment/AssessmentState';
import { useMaterials } from '../intake/Materials';
import { IntakeStatus } from '../../ui/IntakeStatus';
import { readableError } from '../../services/types';
import { ActionLink, Alert, Button, Card, Icon, PageTitle, KikiDots } from '../../ui/kit';

export function Home() {
  const { profile } = useSession();
  const materials = useMaterials();
  const checks = useAssessmentState();
  const pendingCheck = checks.overview?.attempts.find(a => a.run.status === 'in_progress');
  const conceptCoverage = checks.overview?.attempts.some(a => a.result) ? `${checks.overview.concepts.filter(c => c.status === 'passed').length}/10 checks passed` : 'Not assessed';
  if (!profile) return null;
  if (!demoPathAvailable(profile)) return <StudyPath home />;
  const enrolled = profile.courseIds.includes(COURSE.id);
  return <div className="page-stack home-refined">
    <div className="home-greeting"><PageTitle eyebrow="YOUR LEARNING SPACE" title={`Hello, ${profile.displayName.split(' ')[0]}.`}>A little clearer, one concept at a time.</PageTitle><div className="greeting-dots"><KikiDots size={48} /></div></div>
    {!enrolled ? <Card className="start-card"><div className="start-icon"><Icon name="auto_stories" /></div><div><span className="eyebrow">LET’S FIND YOUR STARTING POINT</span><h2>Add your first subject.</h2><p>Your syllabus, today’s notes and lab manuals can live together in one learning space.</p><ActionLink to="/subjects">Add your subject<Icon name="add" /></ActionLink></div></Card> : <LearningContinuation />}
    {(materials.uploading || materials.uploadError) && <Card><p role="status">{materials.uploading ? 'Your material is being received. You can continue using Kiki.' : materials.uploadError}</p><ActionLink to="/library" variant="secondary">Check Library<Icon name="folder_open" /></ActionLink></Card>}
    <div className="home-workbench">
      <section className="home-main" aria-label="Learning actions">
        <Card className="home-check-entry"><div><span className="eyebrow">CHECK YOUR UNDERSTANDING</span><h2>{pendingCheck ? 'Pick up your saved concept check.' : 'Check a concept you’ve studied.'}</h2><p>{pendingCheck ? `${pendingCheck.run.responses.length}/${pendingCheck.run.questions.length} answers saved. Continue the same attempt.` : 'Five bilingual questions, then clear feedback on what to revisit.'}</p></div><ActionLink variant="secondary" to={pendingCheck ? `/assessments/${pendingCheck.run.assessmentId}/${pendingCheck.run.runId}` : '/practice'}>{pendingCheck ? 'Resume check' : 'Practise concepts'}<Icon name="arrow_forward" /></ActionLink></Card>
        <div className="home-tools"><div className="section-title"><h2>On your desk</h2><span className="eyebrow">KEEP GOING</span></div><div className="quick-grid"><ActionLink to={enrolled ? `/subjects/${COURSE.id}/material` : '/subjects'} variant="secondary" className="quick-card"><span className="quick-icon"><Icon name="upload_file" /></span><strong>Add today’s material</strong><span>Keep notes with their subject.</span><Icon name="arrow_forward" /></ActionLink><ActionLink to="/labs" variant="secondary" className="quick-card"><span className="quick-icon lab-text"><Icon name="science" /></span><strong>Prepare for a lab</strong><span>Understand why, then try it.</span><Icon name="arrow_forward" /></ActionLink></div></div>
        <Card className="learning-preference"><Icon name="translate" /><div><strong>{profile.supportLanguage === 'en' ? 'English explanations.' : `${languageName(profile.supportLanguage)} explanations. English terms.`}</strong><p>{fieldName(selectedField(profile))} · Your starting support is {profile.dialLevel}/5. You’re in control.</p></div><ActionLink variant="text" to="/profile">Change<Icon name="arrow_forward" /></ActionLink></Card>
      </section>
      <aside className="home-aside" aria-label="Learning overview">
        <Card className="dimensions-card"><span className="eyebrow">FOUR WAYS TO GROW</span><h2>Your learning, clearly.</h2><p>Each area grows from its own evidence.</p>{checks.overview?.attempts.some(a => a.run.origin === 'preview_setup') && <p className="helper-note">Includes explicitly loaded preview prerequisite setup.</p>}<ul className="dimension-list">{[{ dot: 'concept', label: 'Concept understanding' }, { dot: 'words', label: 'Technical words' }, { dot: 'english', label: 'Academic English' }, { dot: 'lab', label: 'Practical application' }].map(d => <li key={d.dot}><i className={`${d.dot}-dot`} /><span>{d.label}</span><small>{d.dot === 'concept' ? conceptCoverage : 'Not assessed'}</small></li>)}</ul></Card>
        {enrolled && <ResumeLab />}
        {materials.requests.length > 0 && <Card className="recent-material"><span className="eyebrow">RECENT UPLOADS</span>{materials.requests.slice(0,3).map(r => <div key={r.id}><strong>{r.sources.map(source => source.title).join(', ')}</strong><IntakeStatus status={r.status} /></div>)}<ActionLink to="/library" variant="text">View Library<Icon name="arrow_forward" /></ActionLink></Card>}
      </aside>
    </div>
  </div>;
}

export function Subjects() {
  const { profile, enroll } = useSession();
  const [semester, setSemester] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!profile) return null;
  if (!demoPathAvailable(profile)) return <StudyPath />;
  const enrolled = profile.courseIds.includes(COURSE.id);
  return <div className="page-stack subjects-refined"><PageTitle eyebrow="YOUR SUBJECTS" title={enrolled ? 'Analog Communication' : 'Add your first subject.'}>Start with your subject. Bring your syllabus or today’s notes next.</PageTitle><div className="subject-workbench">{enrolled ? <Card className="subject-card"><div className="subject-top"><span className="subject-code">ECE</span><span className="status-pill">Added to your subjects</span></div><h2>{COURSE.name}</h2><p>Your chapter: {COURSE.chapter}</p><ActionLink to={`/subjects/${COURSE.id}`}>Open subject<Icon name="arrow_forward" /></ActionLink></Card> : <Card className="form-card"><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await enroll(COURSE.id, Number(semester)); } catch (err) { setError(readableError(err)); } finally { setBusy(false); } }}><h2>Set up your subject</h2><p className="helper-note">Choose your semester to add Analog Communication.</p><div className="study-context-summary"><span className="eyebrow">YOUR CHOSEN FIELD</span><strong>{fieldName(selectedField(profile))}</strong><ActionLink variant="text" to="/profile">Change field</ActionLink></div><label htmlFor="semester">Semester</label><select id="semester" required value={semester} onChange={e => setSemester(e.target.value)}><option value="">Choose your semester</option>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>Semester {i + 1}</option>)}</select><label htmlFor="subject">Subject</label><select id="subject" value={COURSE.id} disabled><option value={COURSE.id}>{COURSE.name}</option></select><p className="helper-note">Starting with Analog Communication for the ECE chapter.</p>{error && <Alert>{error}</Alert>}<Button type="submit" disabled={busy || !semester}>{busy ? 'Adding subject…' : 'Add subject'}<Icon name="add" /></Button></form></Card>}<aside className="subject-guide"><span className="eyebrow">YOUR STUDY ROUTE</span><h2>Start with an idea.<br/> Build from there.</h2><ol><li><strong>Read the chapter</strong><span>{`Ten concepts with ${languageName(profile.supportLanguage)} support.`}</span></li><li><strong>Check your understanding</strong><span>Revisit the ideas you want to practise.</span></li><li><strong>Prepare for the lab</strong><span>Plan the DSB-SC experiment and keep your notes.</span></li></ol></aside></div></div>;
}
export function SubjectOverview() {
  const { profile } = useSession();
  const enrolled = profile?.courseIds.includes(COURSE.id);
  return <div className="page-stack subject-refined"><PageTitle eyebrow="ECE · SUBJECT" title={COURSE.name}>Your notes, chapter and experiment — together.</PageTitle>{!enrolled ? <Card><h2>Add this subject first.</h2><ActionLink to="/subjects">Add subject<Icon name="add" /></ActionLink></Card> : <div className="subject-overview-grid"><Card className="subject-card"><span className="dimension-label"><i className="concept-dot" />CHAPTER</span><h2>{COURSE.chapter}</h2><p>Ten concepts, from message and carrier signals to coherent demodulation.</p><div className="form-actions"><ActionLink to={`/chapters/${COURSE.chapterId}`}>View chapter<Icon name="arrow_forward" /></ActionLink><ActionLink to="/practice" variant="secondary">Concept checks<Icon name="quiz" /></ActionLink></div></Card><Card className="material-boundary"><Icon name="upload_file" /><h2>Your material belongs here.</h2><p>Add your syllabus to organise the subject, or upload what was taught today. Your previous uploads will appear in Library.</p><div className="form-actions"><ActionLink to={`/subjects/${COURSE.id}/material?kind=syllabus`} variant="secondary">Add syllabus<Icon name="upload_file" /></ActionLink><ActionLink to={`/subjects/${COURSE.id}/material?kind=notes`} variant="secondary">Add today’s material<Icon name="add" /></ActionLink><ActionLink to="/library" variant="text">Open Library<Icon name="folder_open" /></ActionLink></div></Card></div>}</div>;
}
