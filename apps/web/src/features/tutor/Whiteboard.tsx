import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BoardItem, LText } from '../../contracts/tutor';
import { BlockDiagram, Spectrum, Waveform } from './figures';
import styles from './Tutor.module.css';

type Lang = 'en' | 'or';
const pick = (t: LText | undefined, lang: Lang) => (t ? (lang === 'or' && t.or) || t.en : '');
const langOf = (t: LText | undefined, lang: Lang) => (lang === 'or' && t?.or ? 'or' : 'en');

export function Tex({ tex, display = true }: { tex: string; display?: boolean }) {
  // KaTeX output with trust off: no raw HTML or URLs from content can reach the page.
  const html = useMemo(() => katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' }), [tex, display]);
  const ref = useRef<HTMLSpanElement>(null);
  // Wide equations shrink to fit their column (down to 70%); past that, the line scrolls sideways.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !display) return;
    const fit = () => {
      el.style.fontSize = '';
      const over = el.scrollWidth - el.clientWidth;
      if (over > 1 && el.clientWidth > 0) el.style.fontSize = `${Math.max(0.7, el.clientWidth / el.scrollWidth).toFixed(3)}em`;
    };
    fit();
    // refit only when the column's width changes, on the next frame (no resize feedback loop)
    const parent = el.parentElement ?? el;
    let width = parent.clientWidth, frame = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (parent.clientWidth === width) return;
      width = parent.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }) : null;
    ro?.observe(parent);
    return () => { ro?.disconnect(); cancelAnimationFrame(frame); };
  }, [html, display]);
  return <span ref={ref} className={styles.tex} dangerouslySetInnerHTML={{ __html: html }} />;
}

export type TermLookup = Record<string, { term: string; meaning?: LText }>;
export type StageInfo = { id: string; title: LText };

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

/** The pinned question, compact once work has started: the givens stay in view; the full text is one tap away. */
function QuestionBar({ item, lang, started, sheet }: { item: Extract<BoardItem, { kind: 'question' }>; lang: Lang; started: boolean; sheet: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null);   // null: follow `started`
  const expanded = sheet || (open ?? !started);
  return (
    <div className={sheet ? styles.questionSheet : styles.questionBar} data-item={item.id} data-kind="question" data-expanded={expanded}>
      {expanded
        ? <Item item={item} lang={lang} terms={{}} />
        : <ul className={styles.givens} aria-label="Given">{(item.given ?? []).map((g, i) => <li key={i} lang={langOf(g, lang)}>{pick(g, lang)}</li>)}</ul>}
      {!sheet && <button type="button" className={styles.questionToggle} aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
        {expanded ? 'Show only the given values' : 'Show the full question'}
      </button>}
    </div>
  );
}

/**
 * KiKi's whiteboard: cumulative, grouped by stage, in reveal order. Only revealed items ever reach
 * the client. Live: finished stages fold to their results; the current stage stays open; the newest
 * item scrolls into view. Sheet: everything open, for the revision sheet.
 */
export function Whiteboard({ items, shown, fresh, focus = [], lang, terms = {}, label = 'Whiteboard', stages = [], currentStage = 0, mode = 'live' }: {
  items: BoardItem[]; shown: Set<string>; fresh?: Set<string>; focus?: string[]; lang: Lang; terms?: TermLookup; label?: string;
  stages?: StageInfo[]; currentStage?: number; mode?: 'live' | 'sheet';
}) {
  const sheet = mode === 'sheet';
  const visible = items.filter(i => shown.has(i.id));
  const question = visible.find((i): i is Extract<BoardItem, { kind: 'question' }> => i.kind === 'question');
  const termItems = visible.filter(i => i.kind === 'term');
  const rest = visible.filter(i => i.kind !== 'term' && i.kind !== 'question');
  const order = stages.map(s => s.id);
  const groups = order.map((id, index) => ({ id, index, title: stages[index].title, items: rest.filter(i => i.stage === id) }))
    .filter(g => g.items.length);
  const loose = rest.filter(i => !i.stage || !order.includes(i.stage));
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLElement>(null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the newest revealed item comes into view (its stage is open because it is fresh)
  useEffect(() => {
    if (sheet || !fresh?.size) return;
    const ids = [...fresh];
    const el = listRef.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(ids[ids.length - 1])}"]`);
    const board = boardRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    // Desktop: the board is its own scroll column, so move only the board (scrollIntoView would also
    // nudge the page and push the workspace off the top). Phones: the page scrolls, so use the page.
    if (board && board.scrollHeight > board.clientHeight && getComputedStyle(board).overflowY !== 'visible') {
      const top = el.getBoundingClientRect().top - board.getBoundingClientRect().top + board.scrollTop;
      const pinned = board.querySelector<HTMLElement>('[data-kind="question"]')?.offsetHeight ?? 0;
      const target = Math.max(0, Math.min(top - pinned - 16, top + el.offsetHeight - board.clientHeight + 16));
      if (target > board.scrollTop || top - pinned < board.scrollTop) board.scrollTo({ top: target, behavior });
    } else {
      el.scrollIntoView?.({ block: 'nearest', behavior });
    }
  }, [fresh, sheet, reduced]);

  const isOpen = (g: { id: string; index: number; items: BoardItem[] }) =>
    sheet || (manual[g.id] ?? (g.index >= currentStage || g.items.some(i => fresh?.has(i.id))));
  const renderItem = (item: BoardItem) => (
    <li key={item.id} data-item={item.id} data-kind={item.kind}
      className={[styles.boardItem, fresh?.has(item.id) && styles.fresh, focus.includes(item.id) && styles.focus].filter(Boolean).join(' ')}>
      <Item item={item} lang={lang} terms={terms} />
    </li>
  );

  return (
    <section ref={boardRef} className={sheet ? styles.sheetBoard : styles.board} aria-label={label}>
      {question && <QuestionBar item={question} lang={lang} started={groups.length > 0} sheet={sheet} />}
      <div ref={listRef} aria-live="polite">
        {groups.map(g => {
          const open = isOpen(g);
          const results = g.items.filter(i => i.kind === 'result');
          return (
            <section key={g.id} className={styles.stageGroup} data-stage={g.id} data-open={open} aria-label={pick(g.title, lang)}>
              <button type="button" className={styles.stageHead} aria-expanded={open} disabled={sheet}
                onClick={() => setManual(m => ({ ...m, [g.id]: !open }))}>
                <span className={styles.stageNum}>{g.index + 1}</span>
                <span lang={langOf(g.title, lang)}>{pick(g.title, lang)}</span>
                {!sheet && g.index < currentStage && <span className={styles.stageDone} aria-hidden="true">✓</span>}
              </button>
              {open
                ? <ol className={styles.boardList}>{g.items.map(renderItem)}</ol>
                : <div className={styles.stageSummary}>
                    {results.map(r => <div key={r.id} className={styles.result}>{r.kind === 'result' && r.tex && <Tex tex={r.tex} display={false} />}{r.kind === 'result' && r.text && <span lang={langOf(r.text, lang)}> {pick(r.text, lang)}</span>}</div>)}
                    {!results.length && <span className={styles.stageMore}>{g.items.length} items</span>}
                    {/* collapsed items stay in the DOM, hidden: reopening is instant and the whole board stays inspectable */}
                    <ol hidden>{g.items.map(renderItem)}</ol>
                  </div>}
            </section>
          );
        })}
        {!!loose.length && <ol className={styles.boardList}>{loose.map(renderItem)}</ol>}
      </div>
      {!!termItems.length && (
        <div className={styles.termRow} aria-label="Terms">
          {termItems.map(item => <span key={item.id} data-item={item.id} className={fresh?.has(item.id) ? styles.fresh : undefined}><Item item={item} lang={lang} terms={terms} /></span>)}
        </div>
      )}
    </section>
  );
}
