import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useSession } from '../../app/Session';
import { assertOwner, MATERIAL_LABELS, type SourceAsset } from '../../contracts/intake';
import { COURSE } from '../../contracts/profile';
import { readableError } from '../../services/types';
import { useMaterials } from '../intake/Materials';
import { IntakeStatus } from '../../ui/IntakeStatus';
import { ActionLink, Alert, Button, Card, Icon, PageTitle } from '../../ui/kit';

export function Library() {
  const { requests, loading, error, refresh, hasMore, loadingMore, loadMore, uploading, uploadError, cancelUpload } = useMaterials();
  const { profile, services } = useSession();
  const enrolled = profile?.courseIds.includes(COURSE.id);
  return <div className="page-stack"><div className="library-heading"><PageTitle eyebrow="YOUR ORIGINALS AND REQUESTS" title="Your Library">Keep your syllabus, notes and lab manuals close. Return to processing or open an original.</PageTitle><ActionLink to={enrolled ? `/subjects/${COURSE.id}/material` : '/subjects'}>Add material<Icon name="add" /></ActionLink></div><Button variant="text" disabled={loading} onClick={() => refresh()}>Refresh Library<Icon name="refresh" /></Button>{uploading && <Card><p role="status">{services.mode === 'fixture' ? 'Saving the selected originals in this browser…' : 'Uploading material…'}</p><Button variant="secondary" onClick={cancelUpload}>Stop upload</Button></Card>}{uploadError && <Alert>{uploadError}</Alert>}{error && <Alert>{error}<Button variant="text" onClick={() => refresh()}>Retry loading</Button></Alert>}{loading && !requests.length ? <p role="status">Loading your material…</p> : !requests.length && error ? null : !requests.length ? <Card className="library-empty"><Icon name="folder_open" /><h2>A home for your first notes.</h2><p>Add your syllabus or something taught today. Your originals will appear here.</p><ActionLink to={enrolled ? `/subjects/${COURSE.id}/material` : '/subjects'}>Add your first material<Icon name="arrow_forward" /></ActionLink></Card> : <div className="library-grid">{requests.map(request => <Card key={request.id} className="library-card"><div className="subject-top"><span className="eyebrow">{MATERIAL_LABELS[request.kind].toUpperCase()}</span><IntakeStatus status={request.status} /></div><h2>{request.topic}</h2><p>{request.sources.length} original file{request.sources.length > 1 ? 's' : ''} · Analog Communication</p><ActionLink to={`/intake/${request.id}`} variant="secondary">{request.status === 'needs_review' ? 'Review outline' : request.status === 'failed' ? 'Review and retry' : 'Open request'}<Icon name="arrow_forward" /></ActionLink><ul className="library-originals">{request.sources.map(source => <li key={source.id}><ActionLink variant="text" to={`/library/${source.id}`}><Icon name={source.mime === 'application/pdf' ? 'picture_as_pdf' : 'image'} /><span>{source.title}</span><Icon name="open_in_new" /></ActionLink></li>)}</ul></Card>)}</div>}{hasMore && <Button variant="secondary" disabled={loading || loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading more…' : 'Load more material'}<Icon name="arrow_forward" /></Button>}{services.mode === 'fixture' && <p className="helper-note">Sample preview: originals and request states are stored in this browser. They do not sync to another device.</p>}</div>;
}
export function SourceViewer() {
  const { sourceId = '' } = useParams(); const { profile, services } = useSession();
  const [source, setSource] = useState<SourceAsset | null>(null), [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let localUrl = '';
    setSource(null); setUrl(''); setError('');
    services.intake.source(sourceId, controller.signal).then(result => {
      if (controller.signal.aborted || !profile) return;
      assertOwner(result.source, profile.id); localUrl = URL.createObjectURL(result.blob); setSource(result.source); setUrl(localUrl);
    }).catch(e => { if (!controller.signal.aborted) setError(readableError(e)); });
    return () => { controller.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [sourceId, profile, services]);
  return <div className="page-stack"><PageTitle eyebrow="LIBRARY · ORIGINAL FILE" title={source?.title ?? 'Opening your original…'}>{source ? 'This is your original file. Processing does not replace it.' : ''}</PageTitle>{error && <Alert>{error}</Alert>}{source && <><div className="form-actions"><ActionLink to={`/intake/${source.requestId}`} variant="secondary">Back to request<Icon name="arrow_back" /></ActionLink><a className="button button-secondary" href={url} download={source.title}>Download original<Icon name="download" /></a></div><Card className="original-view">{source.mime === 'application/pdf' ? <object data={url} type="application/pdf" aria-label={`Original PDF: ${source.title}`}><p>Your browser cannot display this PDF inline. Use Download original.</p></object> : <img src={url} alt={`Original document: ${source.title}`} onError={() => setError('This image could not be displayed. Download the original or add a clearer file.')} />}</Card><p className="helper-note">{source.mime} · {(source.size / 1024).toFixed(1)} KB. Page counts and extracted text will come from the reading service.</p></>}<ActionLink to="/library" variant="text">Library<Icon name="folder_open" /></ActionLink></div>;
}
