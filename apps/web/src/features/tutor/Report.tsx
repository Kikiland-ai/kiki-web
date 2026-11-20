import type { QuestionView, Report as ReportData } from '../../contracts/tutor';
import { Button, StatusBadge } from '../../ui/learning';
import { Whiteboard } from './Whiteboard';
import { pickText } from './useTutorSession';
import styles from './Tutor.module.css';

const LEVEL: Record<string, string> = { ok: 'Got it', partial: 'Partly', not_yet: 'Not yet', 'n/a': 'Not measured' };
const DIM_LABEL: Record<string, string> = { concept: 'Concept', words: 'Words', english: 'Expression', lab: 'Practice' };

export function Report({ report, question, lang, onRestart }: { report: ReportData; question: QuestionView; lang: 'en' | 'or'; onRestart: () => void }) {
  const metricLabel = (id: string) => { const m = question.metrics.find(x => x.id === id); return m ? pickText(m.label, lang) : id; };
  const stageTitle = (id: string) => { const s = question.stages.find(x => x.id === id); return s ? pickText(s.title, lang) : id; };
  const shown = new Set(report.board.map(i => i.id));
  return (
    <section className={styles.report} aria-labelledby="tutor-report-title">
      <h2 id="tutor-report-title">Your scorecard</h2>
      {report.summary && <p className={styles.summary} lang={lang}>{report.summary}</p>}
      <ul className={styles.metrics} aria-label="How you did">
        {report.metrics.map(m => (
          <li key={m.id} className={styles[`metric_${m.dim}`]} data-metric={m.id} data-level={m.level}>
            <span className={styles.metricName}>{metricLabel(m.id)} <small>{DIM_LABEL[m.dim]}</small></span>
            <StatusBadge label={LEVEL[m.level]} dimension={m.dim} tone={m.level === 'ok' ? 'success' : m.level === 'not_yet' ? 'not_yet' : 'neutral'} />
            {!!m.quotes.length && <q className={styles.quote}>{m.quotes[0]}</q>}
          </li>
        ))}
      </ul>
      <div className={styles.pointers}>
        {!!report.revise.length && (
          <div><h3>Revise</h3><ul>{report.revise.map(r => <li key={r.concept}><strong>{r.title ?? r.concept}</strong> <span>· {r.why}</span></li>)}</ul></div>
        )}
        {!!report.strengthen.length && (
          <div><h3>Strengthen</h3><ul>{report.strengthen.map(r => <li key={r.concept}><strong>{r.title ?? r.concept}</strong> <span>· {r.why}</span></li>)}</ul></div>
        )}
        {!!report.next.length && (
          <div><h3>Next</h3><ul>{report.next.map(n => <li key={n.id}>{pickText(n.why, lang)}</li>)}</ul></div>
        )}
      </div>
      <details className={styles.stages}>
        <summary>Stage by stage</summary>
        <table>
          <thead><tr><th>Stage</th><th>Turns</th><th>Hints</th><th>Result</th></tr></thead>
          <tbody>{report.stages.map(s => (
            <tr key={s.id}><td>{stageTitle(s.id)}</td><td>{s.turns}</td><td>{s.hints}{s.forced ? ' · answer shown' : ''}</td><td>{LEVEL[s.level]}</td></tr>
          ))}</tbody>
        </table>
      </details>
      <section className={styles.sheet} aria-labelledby="tutor-sheet-title">
        <div className={styles.sheetHead}>
          <h3 id="tutor-sheet-title">Your revision sheet</h3>
          <Button variant="secondary" onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
        <Whiteboard items={report.board} shown={shown} lang={lang} label="Revision sheet" />
      </section>
      <Button variant="text" onClick={onRestart}>Talk it through again</Button>
    </section>
  );
}
