import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { COURSE } from '../../contracts/profile';
import { MATERIAL_KINDS, MATERIAL_LABELS, MAX_FILES, validateMaterial } from '../../contracts/intake';
import { useMaterials } from './Materials';
import { readableError } from '../../services/types';
import { ActionLink, Alert, Button, Card, Icon, PageTitle } from '../../ui/kit';

export function AddMaterial() {
  const { courseId } = useParams(); const [params] = useSearchParams(); const { profile, services } = useSession();
  const { upload, uploading, cancelUpload } = useMaterials(); const navigate = useNavigate();
  const initialKind = params.get('kind');
  const [kind, setKind] = useState<typeof MATERIAL_KINDS[number]>(MATERIAL_KINDS.find(k => k === initialKind) ?? 'notes');
  const [topic, setTopic] = useState(COURSE.chapter as string), [note, setNote] = useState(''), [date, setDate] = useState('');
  const [files, setFiles] = useState<File[]>([]), [errors, setErrors] = useState<string[]>([]), [error, setError] = useState(''), [validating, setValidating] = useState(false);
  const key = useRef(crypto.randomUUID()), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (courseId !== COURSE.id || !profile?.courseIds.includes(COURSE.id)) return <Navigate to="/subjects" replace />;
  const chooseFiles = async (selection: FileList | null) => {
    if (!selection) return;
    setValidating(true); setError(''); key.current = crypto.randomUUID();
    const accepted: File[] = [], problems: string[] = [];
    try {
      for (const file of [...selection]) { const issue = await validateMaterial(file); if (issue) problems.push(issue); else accepted.push(file); }
      if (!mounted.current) return;
      const next = [...files];
      accepted.forEach(file => { if (!next.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file); });
      if (next.length > MAX_FILES) problems.push('Choose up to five files in one request. Extra files were not added.');
      setFiles(next.slice(0, MAX_FILES));
      setErrors(problems);
    } catch { setError('This file could not be read. Try choosing it again.'); } finally { if (mounted.current) setValidating(false); }
  };
  return <div className="page-stack"><PageTitle eyebrow="ANALOG COMMUNICATION · YOUR MATERIAL" title="Bring what you learned today.">Add a syllabus, notes or lab manual. Keep the originals together with your subject.</PageTitle><div className="intake-layout"><Card className="form-card intake-form"><form onSubmit={async e => {
    e.preventDefault(); setError('');
    try { const request = await upload({ courseId: COURSE.id, kind, topic, note, classDate: date, files }, key.current); if (mounted.current) navigate(`/intake/${request.id}`); }
    catch (e) { if (mounted.current) setError(`${readableError(e)} Check Library before retrying an unconfirmed upload. Your selected files are still here.`); }
  }}><label htmlFor="material-kind">What are you adding?</label><select id="material-kind" value={kind} disabled={uploading} onChange={e => { setKind(e.target.value as typeof kind); key.current = crypto.randomUUID(); }}>{MATERIAL_KINDS.map(k => <option key={k} value={k}>{MATERIAL_LABELS[k]}</option>)}</select><label htmlFor="material-topic">Chapter or topic</label><input id="material-topic" value={topic} maxLength={180} required disabled={uploading} onChange={e => { setTopic(e.target.value); key.current = crypto.randomUUID(); }} /><label htmlFor="class-date">Class date <span className="optional">optional</span></label><input id="class-date" type="date" value={date} disabled={uploading} onChange={e => { setDate(e.target.value); key.current = crypto.randomUUID(); }} /><label htmlFor="material-note">Tell Kiki what this covers <span className="optional">optional</span></label><textarea id="material-note" rows={3} maxLength={1000} placeholder="This was taught today…" value={note} disabled={uploading} onChange={e => { setNote(e.target.value); key.current = crypto.randomUUID(); }} /><div className="file-picker"><Icon name="upload_file" /><strong>Choose your documents or clear photos.</strong><p>PDF, JPEG or PNG · up to 10 MB each · five files per request</p><label className="button button-secondary" htmlFor="material-files">Choose files<Icon name="add" /></label><input className="sr-only" id="material-files" type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={uploading || validating} onChange={e => { void chooseFiles(e.target.files); e.target.value = ''; }} /></div>{validating && <p role="status">Checking file formats…</p>}{errors.length > 0 && <Alert><ul>{errors.map(message => <li key={message}>{message}</li>)}</ul><span>Valid files remain selected.</span></Alert>}{files.length > 0 && <ul className="attachment-list">{files.map((file,i) => <li key={`${file.name}-${i}`}><Icon name={file.type === 'application/pdf' ? 'picture_as_pdf' : 'image'} /><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB · {file.type}</small></div><Button type="button" variant="text" disabled={uploading} aria-label={`Remove ${file.name}`} onClick={() => { setFiles(old => old.filter((_,n) => n !== i)); key.current = crypto.randomUUID(); }}><Icon name="close" /></Button></li>)}</ul>}{services.mode === 'fixture' && <div className="quiet-note"><Icon name="info" /><span>Sample preview: these originals stay in this browser. OCR and generated lessons are not connected. You’ll choose labelled sample processing states next.</span></div>}{error && <Alert>{error}</Alert>}<div className="form-actions"><Button type="submit" disabled={!files.length || uploading || validating || !topic.trim()}>{uploading ? services.mode === 'fixture' ? 'Saving originals…' : 'Uploading…' : services.mode === 'fixture' ? 'Save material in preview' : 'Upload material'}<Icon name="arrow_forward" /></Button>{uploading && <Button type="button" variant="secondary" onClick={cancelUpload}>Stop upload</Button>}</div>{uploading && <p role="status" className="helper-note">The upload stays active if you open another Kiki page. Its received request will appear in Library.</p>}</form></Card><div className="intake-support"><Card><span className="eyebrow">WHAT HAPPENS NEXT</span><ol className="intake-next"><li>Keep your original files.</li><li>Read the material and identify concepts.</li><li>You review the chapter outline.</li><li>Prepare lessons in your chosen language.</li></ol>{services.mode === 'connected' && <p className="helper-note">The current version saves originals in Library. Reading, outline review and lesson preparation will follow when available.</p>}<p className="helper-note">Without a confirmed syllabus, the outline is provisional. Adding notes does not erase your learning progress.</p></Card><ActionLink to="/library" variant="secondary">Open Library<Icon name="folder_open" /></ActionLink></div></div></div>;
}
