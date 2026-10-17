import { useEffect, useState } from 'react';
import { useSession } from '../../app/Session';
import type { ChapterProgress, ChapterView } from '../../contracts/api';
import { COURSE } from '../../contracts/profile';
import { readableError, ServiceError } from '../../services/types';
import { ActionLink, Button, Card, Icon } from '../../ui/kit';
import { nextConceptId } from '../learning/nextConcept';
import styles from './LearningContinuation.module.css';

type Load = { chapter: ChapterView; progress: ChapterProgress };

/** Home uses the same recommendation policy and authoritative progress as the chapter. */
export function LearningContinuation() {
  const { services, profile } = useSession();
  const [data, setData] = useState<Load | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const uid = profile?.id;
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    Promise.all([
      services.learning.getChapter(COURSE.chapterId, controller.signal),
      services.learning.getProgress(COURSE.chapterId, controller.signal),
    ]).then(([chapter, progress]) => {
      if (controller.signal.aborted) return;
      if (progress.ownerLearnerId !== uid) throw new ServiceError('The progress does not match your account.');
      setData({ chapter, progress });
    }).catch(e => { if (!controller.signal.aborted) setError(readableError(e)); });
    return () => controller.abort();
  }, [services, uid, retry]);

  const nextId = data && nextConceptId(data.chapter, data.progress);
  const next = data?.chapter.concepts.find(c => c.id === nextId);
  const passed = data?.progress.concepts.filter(c => c.status === 'passed').length ?? 0;
  const total = data?.chapter.concepts.length ?? 10;
  return <Card className={styles.cover}>
    <div className={styles.copy}>
      <span className="eyebrow">YOUR OPEN SKETCHBOOK · ECE</span>
      <span className={styles.chapter}>{COURSE.name} / {COURSE.chapter}</span>
      <h2>{next?.title.en ?? (data ? 'Every concept check passed.' : 'Make room for the next idea.')}</h2>
      <p>{next ? `Concept ${String(next.order).padStart(2, '0')} of ${total} · Read the idea, explore its words, then check your understanding.` : data ? 'Revisit the chapter or bring your understanding together in its chapter test.' : 'Your chapter and saved place belong together.'}</p>
      {error ? <div role="alert"><p>{error}</p><Button variant="secondary" onClick={() => setRetry(n => n + 1)}>Retry learning continuation</Button></div> : <div className="form-actions">
        <ActionLink to={next ? `/concepts/${next.id}` : `/chapters/${COURSE.chapterId}`}>Continue learning<Icon name="arrow_forward" /></ActionLink>
        <ActionLink to={`/subjects/${COURSE.id}`} variant="text">Open subject</ActionLink>
      </div>}
      {!data && !error && <small role="status">Finding your next concept…</small>}
    </div>
    <aside className={styles.index} aria-label="Chapter check progress">
      <span className={styles.pageNumber}>{next ? String(next.order).padStart(2, '0') : data ? '10' : '—'}</span>
      <span className={styles.indexLabel}>{next ? 'YOUR NEXT PAGE' : data ? 'CHAPTER REVIEW' : 'OPEN NOTEBOOK'}</span>
      <div className={styles.pages} aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={data?.progress.concepts.some(c => c.conceptId === data.chapter.concepts[i]?.id && c.status === 'passed') ? styles.passed : ''} />)}</div>
      <strong>{data ? `${passed} / ${total} checks passed` : 'Loading progress'}</strong>
      <span>Reading is a start.<br />Checks show what stuck.</span>
    </aside>
  </Card>;
}
