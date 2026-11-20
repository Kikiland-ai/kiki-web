import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';
import type { BoardItem, LText } from '../../contracts/tutor';
import { BlockDiagram, Spectrum, Waveform } from './figures';
import styles from './Tutor.module.css';

type Lang = 'en' | 'or';
const pick = (t: LText | undefined, lang: Lang) => (t ? (lang === 'or' && t.or) || t.en : '');
const langOf = (t: LText | undefined, lang: Lang) => (lang === 'or' && t?.or ? 'or' : 'en');

export function Tex({ tex, display = true }: { tex: string; display?: boolean }) {
  // KaTeX output with trust off: no raw HTML or URLs from content can reach the page.
  const html = useMemo(() => katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' }), [tex, display]);
  return <span className={styles.tex} dangerouslySetInnerHTML={{ __html: html }} />;
}

export type TermLookup = Record<string, { term: string; meaning?: LText }>;

function Item({ item, lang, terms }: { item: BoardItem; lang: Lang; terms: TermLookup }) {
  switch (item.kind) {
    case 'question':
      return (
        <div className={styles.questionItem}>
          <p lang={langOf(item.text, lang)}>{pick(item.text, lang)}</p>
          {!!item.given?.length && <ul>{item.given.map((g, i) => <li key={i} lang={langOf(g, lang)}>{pick(g, lang)}</li>)}</ul>}
        </div>
      );
    case 'equation':
      return <div className={styles.equation}>{item.label && <span className={styles.itemLabel} lang={langOf(item.label, lang)}>{pick(item.label, lang)}</span>}<Tex tex={item.tex} /></div>;
    case 'step':
      return <div className={styles.step}><Tex tex={item.tex} />{item.note && <span className={styles.stepNote} lang={langOf(item.note, lang)}>{pick(item.note, lang)}</span>}</div>;
    case 'note':
      return <p className={styles.note} lang={langOf(item.text, lang)}>{pick(item.text, lang)}</p>;
    case 'term': {
      const text = item.term ?? terms[item.termId]?.term ?? item.termId;
      const meaning = item.meaning ?? terms[item.termId]?.meaning;
      return <span className={styles.term} title={meaning ? pick(meaning, lang) : undefined}>{text}</span>;
    }
    case 'result':
      return <div className={styles.result}>{item.tex && <Tex tex={item.tex} />}{item.text && <p lang={langOf(item.text, lang)}>{pick(item.text, lang)}</p>}</div>;
    case 'figure': {
      const caption = pick(item.caption, lang);
      const Fig = item.template === 'waveform' ? Waveform : item.template === 'spectrum' ? Spectrum : BlockDiagram;
      return <figure className={styles.figureItem}><Fig params={item.params} lang={lang} caption={caption} /><figcaption lang={langOf(item.caption, lang)}>{caption}</figcaption></figure>;
    }
  }
}

/** KiKi's whiteboard: cumulative, in reveal order. Only revealed items ever reach the client. */
export function Whiteboard({ items, shown, fresh, focus = [], lang, terms = {}, label = 'Whiteboard' }: {
  items: BoardItem[]; shown: Set<string>; fresh?: Set<string>; focus?: string[]; lang: Lang; terms?: TermLookup; label?: string;
}) {
  const visible = items.filter(i => shown.has(i.id));
  const termItems = visible.filter(i => i.kind === 'term');
  const rest = visible.filter(i => i.kind !== 'term');
  return (
    <section className={styles.board} aria-label={label}>
      <ol className={styles.boardList} aria-live="polite">
        {rest.map(item => (
          <li key={item.id} data-item={item.id} data-kind={item.kind}
            className={[styles.boardItem, fresh?.has(item.id) && styles.fresh, focus.includes(item.id) && styles.focus].filter(Boolean).join(' ')}>
            <Item item={item} lang={lang} terms={terms} />
          </li>
        ))}
      </ol>
      {!!termItems.length && (
        <div className={styles.termRow} aria-label="Terms">
          {termItems.map(item => <span key={item.id} data-item={item.id} className={fresh?.has(item.id) ? styles.fresh : undefined}><Item item={item} lang={lang} terms={terms} /></span>)}
        </div>
      )}
    </section>
  );
}
