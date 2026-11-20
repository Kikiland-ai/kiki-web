import { Link } from 'react-router';
import { useSession } from '../../app/Session';
import { TUTOR_CATALOG } from '../../contracts/tutor';
import { Icon } from '../../ui/icons';
import { StatusBadge } from '../../ui/learning';
import styles from './Tutor.module.css';

/** /talk — every "talk it through" question, reachable from Home, Subject, Checks and results. */
export function TutorHub() {
  const { services } = useSession();
  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <span className={styles.back}>ANALOG COMMUNICATION · TALK IT THROUGH</span>
        <h1>Talk it through with KiKi</h1>
        <p className={styles.hubLead}>
          KiKi asks you short questions, one stage at a time, by voice or by typing, in Odia or English. The board
          fills in as you work it out, and you finish with a scorecard and a revision sheet.
        </p>
      </header>
      {!services.tutor && <p role="alert">Tutor mode is not available here.</p>}
      <ul className={styles.hubList} aria-label="Questions to talk through">
        {TUTOR_CATALOG.map(q => (
          <li key={q.id}>
            <Link to={`/concepts/${q.conceptId}/talk/${q.id}`} className={styles.hubCard}>
              <span className={styles.hubIcon}><Icon name="forum" /></span>
              <span className={styles.hubBody}>
                <strong>{q.title}</strong>
                <span>{q.summary}</span>
                <small>{q.concepts}</small>
              </span>
              <StatusBadge label={q.difficulty === 'hard' ? 'Hard' : 'Medium'} />
              <Icon name="arrow_forward" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
