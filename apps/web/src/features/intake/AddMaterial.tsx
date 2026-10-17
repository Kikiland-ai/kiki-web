import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useSession } from '../../app/Session';
import { COURSE } from '../../contracts/profile';
import { MATERIAL_KINDS, MATERIAL_LABELS, MAX_FILES } from '../../contracts/intake';
import type { TextDocument } from '../../contracts/document-text';
import { extractDocument } from './text/extract';
import { useMaterials } from './Materials';
import { readableError } from '../../services/types';
import { ActionLink, Alert, Button, Card, Icon, PageTitle } from '../../ui/kit';

export function AddMaterial() {
  const { courseId } = useParams(), [params] = useSearchParams(), { profile, services } = useSession();
  const { upload, uploading, cancelUpload } = useMaterials(), navigate = useNavigate();
  const [kind, setKind] = useState<typeof MATERIAL_KINDS[number]>(MATERIAL_KINDS.find(k => k === params.get('kind')) ?? 'notes');
  const [topic, setTopic] = useState(COURSE.chapter as string), [note, setNote] = useState(''), [date, setDate] = useState('');
  const [documents, setDocuments] = useState<TextDocument[]>([]), [error, setError] = useState(''), [extracting, setExtracting] = useState(false);
  const key = useRef(crypto.randomUUID()), mounted = useRef(true), extraction = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; const stop = () => extraction.current?.abort(); const unregister = services.auth.registerSignOutCleanup(stop); return () => { mounted.current = false; stop(); unregister(); }; }, [services]);
  if (courseId !== COURSE.id || !profile?.courseIds.includes(COURSE.id)) return <Navigate to="/subjects" replace />;
  const changed = () => { key.current = crypto.randomUUID(); };
  async function chooseFiles(files: FileList | null) {
    if (!files) return;
    const selection = [...files];
    const controller = new AbortController(); extraction.current?.abort(); extraction.current = controller;
    setExtracting(true); setError('');
    const accepted: TextDocument[] = [], errors: string[] = [];
    try {
      if (selection.length + documents.length > MAX_FILES) throw new Error('Choose up to five documents per upload.');
      for (const file of selection) {
        try { accepted.push(await extractDocument(file, controller.signal)); }
        catch { controller.signal.throwIfAborted(); errors.push(`${file.name}: We couldn’t prepare this document. Try an unlocked PDF or PPTX with selectable text, or export a fresh copy.`); }
      }
      if (!mounted.current || controller.signal.aborted) return;
      setDocuments(old => [...old, ...accepted]); changed(); setError(errors.join(' '));
    } catch (e) { if (!controller.signal.aborted && mounted.current) setError(readableError(e)); }
    finally { if (mounted.current && !controller.signal.aborted) setExtracting(false); }
  }
  const busy = uploading || extracting;
  return <div className="page-stack material-refined"><PageTitle eyebrow="ANALOG COMMUNICATION · MATERIAL" title="Add your material.">Upload your syllabus, lecture notes or lab manual. Find your previous uploads in Library.</PageTitle>
    <div className="intake-layout"><div className="page-stack"><Card className="form-card intake-form"><form onSubmit={async e => {
      e.preventDefault(); setError('');
      try { await upload({ courseId: COURSE.id, kind, topic, note, classDate: date, documents }, key.current); if (mounted.current) navigate('/library'); }
      catch (e) { if (mounted.current) setError(`${readableError(e)} Check Library before retrying an uncertain save.`); }
    }}><section className="document-selection" aria-labelledby="document-selection-title"><span className="eyebrow">01 · DOCUMENTS</span><h2 id="document-selection-title">Bring your class material.</h2>    <div className="file-picker"><Icon name="upload_file" /><p>PDF or PPTX · up to 10 MB each · five documents</p><label className="button button-secondary" htmlFor="material-files">Choose documents<Icon name="add" /></label><input className="sr-only" id="material-files" type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" multiple disabled={busy || documents.length >= MAX_FILES} onChange={e => { void chooseFiles(e.target.files); e.target.value = ''; }} /></div>
    {extracting && <p role="status">Preparing your material… <Button type="button" variant="text" onClick={() => { extraction.current?.abort(); setExtracting(false); }}>Cancel preparation</Button></p>}
    {documents.length > 0 && <ul className="selected-materials" aria-label="Selected documents">{documents.map((document, i) => <li key={i}><Icon name={document.mime === 'application/pdf' ? 'picture_as_pdf' : 'description'} /><div><strong>{document.title}</strong><small>{(document.size / 1024).toFixed(1)} KB · Ready to upload</small></div><Button type="button" variant="text" disabled={busy} aria-label={`Remove ${document.title}`} onClick={() => { setDocuments(old => old.filter((_, n) => i !== n)); changed(); }}>Remove</Button></li>)}</ul>}
</section><fieldset className="material-fields"><legend>02 · About this material</legend><label htmlFor="material-kind">What are you adding?</label><select id="material-kind" disabled={busy} value={kind} onChange={e => { setKind(e.target.value as typeof kind); changed(); }}>{MATERIAL_KINDS.map(k => <option key={k} value={k}>{MATERIAL_LABELS[k]}</option>)}</select>
    <label htmlFor="material-topic">Chapter or topic</label><input id="material-topic" value={topic} maxLength={180} required disabled={busy} onChange={e => { setTopic(e.target.value); changed(); }} />
    </fieldset><fieldset className="material-fields"><legend>03 · Optional details</legend><label htmlFor="class-date">Class date (optional)</label><input id="class-date" type="date" disabled={busy} value={date} onChange={e => { setDate(e.target.value); changed(); }} />
    <label htmlFor="material-note">Your note (optional)</label><textarea id="material-note" rows={3} maxLength={1000} disabled={busy} value={note} onChange={e => { setNote(e.target.value); changed(); }} />
    </fieldset>{services.mode === 'fixture' && <p className="helper-note">Sample preview: uploads are saved in this browser only.</p>}
    {error && <Alert>{error}</Alert>}<div className="form-actions"><Button type="submit" disabled={!documents.length || busy || !topic.trim()}>{uploading ? 'Uploading…' : 'Upload material'}<Icon name="arrow_forward" /></Button>{uploading && <Button type="button" variant="secondary" onClick={cancelUpload}>Stop upload</Button>}</div></form></Card>
    </div><aside className="intake-support"><Card><span className="eyebrow">READY FOR CLASS</span><h2>Keep it with your subject.</h2><p>Give your upload a topic so it’s easy to recognise later.</p><p>Add a class date or a short note if you’d like.</p><p className="helper-note">Use an unlocked PDF or PPTX, up to 500 pages or slides. Convert older .ppt files before uploading.</p></Card><ActionLink to="/library" variant="secondary">Open Library<Icon name="folder_open" /></ActionLink></aside></div></div>;
}
