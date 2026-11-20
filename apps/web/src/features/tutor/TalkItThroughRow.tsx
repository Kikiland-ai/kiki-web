import { TUTOR_QUESTIONS } from '../../contracts/tutor';
import { LinkButton } from '../../ui/learning';
import styles from '../learning/LessonScreen.module.css';
import { useTutorAvailable } from './available';

/** The concept page's "Talk it through with KiKi" row: shown only when tutor mode is on and the concept has questions. */
export function TalkItThroughRow({ conceptId }: { conceptId: string }) {
  const tutorOn = useTutorAvailable();
  const questions = TUTOR_QUESTIONS[conceptId] ?? [];
  if (!tutorOn || !questions.length) return null;
  return (
    <nav className={styles.talk} aria-label="Talk it through with KiKi">
      <span className={styles.talkLabel}>TALK IT THROUGH WITH KIKI</span>
      {questions.map(q => (
        <LinkButton key={q.id} variant="secondary" to={`/concepts/${conceptId}/talk/${q.id}`}
          aria-label={`Talk it through with KiKi: ${q.title} (${q.difficulty})`}>
          {q.title} · {q.difficulty}
        </LinkButton>
      ))}
    </nav>
  );
}
