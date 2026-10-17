import { Navigate } from 'react-router';
import { useSession } from '../../app/Session';
import { MATERIAL_LABELS } from '../../contracts/intake';
import { COURSE } from '../../contracts/profile';
import { useMaterials } from '../intake/Materials';
import { ActionLink, Alert, Button, Card, Icon, LoadingNotice, PageTitle } from '../../ui/kit';

export function Library() {
  const { requests, loading, error, refresh, hasMore, loadingMore, loadMore, uploading, uploadError, cancelUpload } = useMaterials();
  const { profile, services } = useSession();
  const enrolled = profile?.courseIds.includes(COURSE.id);
  const uploads = requests.flatMap(request => request.sources.map(source => ({ source, request })));
  return <div className="page-stack library-refined">
    <div className="library-heading"><PageTitle eyebrow="YOUR UPLOADS" title="Your Library">Your syllabus, lecture notes and lab manuals, all in one place.</PageTitle><ActionLink to={enrolled ? `/subjects/${COURSE.id}/material` : '/subjects'}>Add material<Icon name="add" /></ActionLink></div>
    <div className="library-tools"><span className="helper-note">Upload history · Analog Communication</span><Button variant="text" disabled={loading} onClick={() => void refresh()}>Refresh Library<Icon name="refresh" /></Button></div>
    {uploading && <Card><p role="status">Uploading your material…</p><Button variant="secondary" onClick={cancelUpload}>Stop upload</Button></Card>}
    {uploadError && <Alert>{uploadError}</Alert>}
    {error && <Alert>{error}<Button variant="text" onClick={() => void refresh()}>Retry loading</Button></Alert>}
    {loading && !uploads.length ? <LoadingNotice>Loading your uploads…</LoadingNotice> : !uploads.length && error ? null : !uploads.length ? <Card className="library-empty"><Icon name="folder_open" /><h2>A home for your first notes.</h2><p>Add your syllabus or something taught today. Your previous uploads will appear here.</p><ActionLink to={enrolled ? `/subjects/${COURSE.id}/material` : '/subjects'}>Add your first material<Icon name="arrow_forward" /></ActionLink></Card> : <>
      <div className="section-title"><h2>Previous uploads</h2><span className="helper-note">{uploads.length} document{uploads.length === 1 ? '' : 's'}{hasMore ? ' loaded' : ''}</span></div>
      <div className="library-grid">{uploads.map(({ source, request }) => <article className="card library-card upload-card" key={source.id} aria-label={`Uploaded material: ${source.title}`}>
        <div className="subject-top"><span className="upload-file-icon"><Icon name={source.mime === 'application/pdf' ? 'picture_as_pdf' : source.mime.startsWith('image/') ? 'image' : 'description'} /></span><span className="status-pill"><Icon name="check" />Uploaded</span></div>
        <h3>{source.title}</h3><span className="eyebrow">{MATERIAL_LABELS[request.kind].toUpperCase()}</span><p>{request.topic} · Analog Communication</p>
        <div className="upload-card-footer"><span>{source.mime === 'application/pdf' ? 'PDF' : source.mime.includes('presentation') ? 'PPTX' : source.mime.startsWith('image/') ? 'Image' : 'Document'}</span><span>Uploaded <time dateTime={source.createdAt}>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(source.createdAt))}</time></span></div>
      </article>)}</div>
    </>}
    {hasMore && <Button variant="secondary" disabled={loading || loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading more…' : 'Load more uploads'}<Icon name="arrow_forward" /></Button>}
    {services.mode === 'fixture' && <p className="helper-note">Sample preview: uploads stay in this browser and do not sync to another device.</p>}
  </div>;
}
/** Old source links return to the upload history; material cards have no detail view. */
export function SourceViewer() { return <Navigate to="/library" replace />; }
