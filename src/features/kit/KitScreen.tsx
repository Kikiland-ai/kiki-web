import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import type { Dimension, LessonTerm } from '../../contracts'
import {
  Button,
  ChoiceGroup,
  ChoiceOption,
  ErrorState,
  Kiki,
  KikiPointer,
  KIKI_POINTER_TIP,
  type KikiPointerState,
  LanguageDial,
  LoadingState,
  Sheet,
  StatusBadge,
  type DialLevel,
  type KikiState,
  MapNode,
  MasteryRing,
  TermChip,
  TermDetails,
} from '../../ui'
import { ArrowForwardIcon, RetryIcon } from '../../ui/icons'
import { DemoLearnerPanel } from './DemoLearnerPanel'
import styles from './KitScreen.module.css'

const LONG_ODIA = Array(3).fill('ସଂଜ୍ଞା ଏବଂ ଉଦାହରଣ ସହିତ ବିସ୍ତୃତ ବ୍ୟାଖ୍ୟା').join(' ')
const DIMENSIONS: Dimension[] = ['concept', 'words', 'english', 'lab']
const KIKI_STATES: KikiState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'pointing',
  'asking',
  'celebrating',
  'unsure',
  'examiner',
]
// Sample terms from the Analog Modulation content (T-AM-08-*); Odia is draft until reviewed
const TERMS: LessonTerm[] = [
  {
    id: 'T-AM-08-1',
    term: 'phase error',
    definition: 'Relative phase mismatch between receiver and transmitter carriers.',
    pronunciationOr: 'ଫେଜ୍ ଏରର୍',
    glossOr: 'ଦୁଇ Carrier ମଧ୍ୟରେ ଆବଶ୍ୟକ ମେଳଠାରୁ Phase ତଫାତ।',
    example: {
      en: 'A 90-degree relative phase error suppresses the ideal recovered message.',
      or: '90-degree relative Phase error ideal Recovered message କୁ କମାଏ।',
    },
  },
  {
    id: 'T-AM-08-2',
    term: 'frequency mismatch',
    definition: 'A difference between receiver and transmitter carrier frequencies.',
    pronunciationOr: 'ଫ୍ରିକ୍ୱେନ୍ସି ମିସ୍ମ୍ୟାଚ୍',
    glossOr: 'Receiver ଓ Transmitter carrier frequency ଅଲଗା ହେବା।',
  },
  {
    id: 'T-AM-08-3',
    term: 'beating',
    definition: 'A varying signal envelope caused by interaction of nearby frequencies.',
  },
]

const POINTER_STATES: KikiPointerState[] = [
  'idle',
  'pointing',
  'tapping',
  'dragging',
  'tracing',
  'thinking',
  'asking',
  'listening',
  'celebrating',
  'unsure',
  'waiting',
]

const OPTIONS = [
  { id: 'a', text: 'The receiver multiplies by a carrier that is 90° out of phase.' },
  { id: 'b', text: 'The message frequency is higher than the carrier frequency.' },
  { id: 'c', text: 'The low-pass filter cut-off is too high.' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  // aria-labelledby takes a space-separated list of ids, so the id has no spaces
  const id = `kit-${title.replace(/\s+/g, '-')}`
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

/** Odia sample text, marked lang="or" so it gets the Odia font and line height. */
function Or({ children }: { children: ReactNode }) {
  return <span lang="or">{children}</span>
}

/**
 * Dev-only gallery of every kit component in every state, for checks at
 * 320–1440px. Registered only when import.meta.env.DEV.
 */
export function KitScreen() {
  const [params, setParams] = useSearchParams()
  const long = params.get('long') === '1'
  const sample = (english: string) => (long ? <Or>{LONG_ODIA}</Or> : english)

  const [sheet, setSheet] = useState<'term' | 'long' | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [dial, setDial] = useState<DialLevel>(2)
  const [suggested, setSuggested] = useState<DialLevel | null>(3)
  const [retries, setRetries] = useState(0)

  return (
    <div className={styles.kit}>
      <h1>Kit</h1>
      <p className={styles.note}>Dev only: every shared component in every state. Not in production builds.</p>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={long}
          onChange={(e) => setParams(e.target.checked ? { long: '1' } : {}, { replace: true })}
        />
        Long Odia text in the samples
      </label>

      <Section title="Demo learner">
        <DemoLearnerPanel />
      </Section>

      <Section title="Button">
        <div className={styles.row}>
          <Button>{sample('Start lesson')}</Button>
          <Button variant="secondary">{sample('Hear it')}</Button>
          <Button variant="text">{sample('Show me the whole map')}</Button>
        </div>
        <div className={styles.row}>
          <Button icon={<ArrowForwardIcon size={20} />}>{sample('Check this concept')}</Button>
          <Button variant="secondary" icon={<RetryIcon size={20} />}>
            {sample('Retry')}
          </Button>
        </div>
        <div className={styles.row}>
          <Button disabled>Disabled primary</Button>
          <Button variant="secondary" disabled>
            Disabled secondary
          </Button>
          <Button variant="text" disabled>
            Disabled text
          </Button>
        </div>
        <div className={styles.row} lang="or">
          <Button>ପାଠ ଆରମ୍ଭ କର</Button>
          <Button variant="secondary">ଶୁଣ</Button>
        </div>
      </Section>

      <Section title="Sheet">
        <p>Bottom sheet below 600px, right side panel from 600px. Esc, backdrop or Close shuts it.</p>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setSheet('term')}>
            Open term details
          </Button>
          <Button variant="secondary" onClick={() => setSheet('long')}>
            Open a long sheet
          </Button>
        </div>
        <Sheet open={sheet === 'term'} onClose={() => setSheet(null)} title="carrier">
          <p>
            <StatusBadge label="Words" dimension="words" />
          </p>
          <p lang="or">କ୍ୟାରିଅର୍</p>
          <p lang="or">ବାହକ ତରଙ୍ଗ: ଯେଉଁ ଉଚ୍ଚ ଆବୃତ୍ତି ତରଙ୍ଗ ସନ୍ଦେଶକୁ ବହନ କରେ।</p>
          <p>Example: the receiver needs a carrier in phase with the transmitter's.</p>
          {long && <p lang="or">{LONG_ODIA}</p>}
          <Button variant="secondary" onClick={() => setSheet(null)}>
            Done
          </Button>
        </Sheet>
        <Sheet
          open={sheet === 'long'}
          onClose={() => setSheet(null)}
          title={long ? <Or>{LONG_ODIA}</Or> : 'A sheet with more text than fits'}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i} lang={i % 2 ? 'or' : undefined}>
              {i % 2 ? LONG_ODIA : 'The body scrolls inside the sheet; the page behind keeps its place.'}
            </p>
          ))}
          <Button onClick={() => setSheet(null)}>Close sheet</Button>
        </Sheet>
      </Section>

      <Section title="StatusBadge">
        {(['neutral', 'success', 'not_yet'] as const).map((tone) => (
          <div key={tone} className={styles.row}>
            <StatusBadge tone={tone} label={tone === 'success' ? 'Passed' : tone === 'not_yet' ? 'Not yet' : 'Draft'} />
            {DIMENSIONS.map((d) => (
              <StatusBadge key={d} tone={tone} dimension={d} label={`${d} · ${tone}`} />
            ))}
          </div>
        ))}
        <div className={styles.row}>
          <span lang="or">
            <StatusBadge label={long ? LONG_ODIA : 'ପାସ୍'} tone="success" dimension="concept" />
          </span>
        </div>
      </Section>

      <Section title="ChoiceOption">
        <ChoiceGroup label={long ? <Or>{LONG_ODIA}</Or> : 'Why is the demodulated output silent? (try it)'}>
          {OPTIONS.map((o) => (
            <ChoiceOption
              key={o.id}
              name="kit-live"
              value={o.id}
              selected={answer === o.id}
              onChange={() => setAnswer(o.id)}
            >
              {sample(o.text)}
            </ChoiceOption>
          ))}
        </ChoiceGroup>
        <ChoiceGroup label="After checking: correct, not yet, idle">
          <ChoiceOption name="kit-checked" value="a" selected state="correct" disabled>
            {OPTIONS[0].text}
          </ChoiceOption>
          <ChoiceOption name="kit-checked" value="b" selected={false} state="not_yet" disabled>
            {OPTIONS[1].text}
          </ChoiceOption>
          <ChoiceOption name="kit-checked" value="c" selected={false} disabled>
            {OPTIONS[2].text}
          </ChoiceOption>
        </ChoiceGroup>
        <ChoiceGroup label="Picked the wrong one: selected and not yet">
          <ChoiceOption name="kit-wrong" value="b" selected state="not_yet" disabled>
            {OPTIONS[1].text}
          </ChoiceOption>
        </ChoiceGroup>
      </Section>

      <Section title="LanguageDial">
        <LanguageDial
          value={dial}
          onChange={setDial}
          suggested={suggested}
          onAcceptSuggestion={() => setSuggested(null)}
        />
        <div className={styles.row}>
          {([1, 3, 5] as const).map((n) => (
            <Button key={n} variant="text" onClick={() => setSuggested(n)}>
              Suggest notch {n}
            </Button>
          ))}
          <Button variant="text" onClick={() => setSuggested(null)}>
            No suggestion
          </Button>
        </div>
      </Section>

      <Section title="Kiki">
        <div className={styles.grid}>
          {KIKI_STATES.map((s) => (
            <figure key={s} className={styles.figure}>
              <Kiki state={s} />
              <figcaption>{s}</figcaption>
            </figure>
          ))}
        </div>
        <div className={styles.grid}>
          {DIMENSIONS.map((d) => (
            <figure key={d} className={styles.figure}>
              <Kiki state="idle" lead={d} />
              <figcaption>lead: {d}</figcaption>
            </figure>
          ))}
        </div>
        <div className={styles.row}>
          <Kiki state="speaking" size={32} />
          <Kiki state="speaking" />
          <Kiki state="speaking" size={96} />
        </div>
      </Section>

      <Section title="KikiPointer">
        <p className={styles.note}>Lab only, and only while the session's pointer is active.</p>
        <div className={styles.grid}>
          {POINTER_STATES.map((s) => (
            <figure key={s} className={styles.figure}>
              <KikiPointer state={s} />
              <figcaption>{s}</figcaption>
            </figure>
          ))}
        </div>
        <div className={styles.grid}>
          {DIMENSIONS.map((d) => (
            <figure key={d} className={styles.figure}>
              <KikiPointer state="waiting" lead={d} />
              <figcaption>lead: {d}</figcaption>
            </figure>
          ))}
          <figure className={styles.figure}>
            <KikiPointer state="pointing" flip />
            <figcaption>flip</figcaption>
          </figure>
        </div>
        <div className={styles.row}>
          <KikiPointer state="idle" size={40} />
          <KikiPointer state="idle" />
          <KikiPointer state="idle" size={72} />
        </div>
        <div className={styles.stage}>
          <span className={styles.target} style={{ left: 120, top: 32 }} />
          <KikiPointer
            state="tapping"
            lead="lab"
            className={styles.placed}
            style={{ left: 120 - KIKI_POINTER_TIP.x * 48, top: 32 - KIKI_POINTER_TIP.y * 48 }}
          />
        </div>
      </Section>

      <Section title="TermChip and TermDetails">
        <p>
          A receiver with a <TermChip term={TERMS[0]} /> of 90° recovers almost nothing, and a{' '}
          <TermChip term={TERMS[1]} /> of 10 Hz causes <TermChip term={TERMS[2]} />. Tap a term.
        </p>
        <p>At notch 1, chips also show the Odia meaning inline:</p>
        <p lang="or">
          <TermChip term={TERMS[0]} showMeaning /> ଓ <TermChip term={TERMS[1]} showMeaning /> {long && LONG_ODIA}
        </p>
        <div className={styles.card}>
          <TermDetails term={TERMS[0]} />
        </div>
        <div className={styles.card}>
          <TermDetails term={TERMS[2]} />
        </div>
      </Section>

      <Section title="MasteryRing">
        <div className={styles.row}>
          <MasteryRing label="Nothing assessed" values={{}} />
          <MasteryRing label="Concept only" values={{ concept: { done: 3, total: 5 } }} />
          <MasteryRing
            label="Mixed"
            values={{ concept: { done: 5, total: 5 }, words: { done: 0, total: 3 }, english: null, lab: { done: 4, total: 12 } }}
          />
          <MasteryRing
            label="Complete"
            values={{
              concept: { done: 5, total: 5 },
              words: { done: 3, total: 3 },
              english: { done: 2, total: 2 },
              lab: { done: 12, total: 12 },
            }}
          />
        </div>
        <div className={styles.row}>
          <MasteryRing label="Lesson header" size={96} values={{}} showLegend />
          <MasteryRing
            label="Lesson header"
            size={96}
            values={{ concept: { done: 3, total: 5 }, words: { done: 0, total: 3 } }}
            showLegend
          >
            C-AM-08
          </MasteryRing>
        </div>
      </Section>

      <Section title="MapNode">
        <div className={styles.map}>
          <MapNode
            to="/concepts/C-AM-07"
            order={7}
            title="Lowpass filtering and waveform comparison"
            titleOr="Lowpass filtering ଓ Waveform ତୁଳନା"
            status="passed"
            rings={{ concept: { done: 5, total: 5 } }}
            requiredForLab
          />
          <MapNode
            to="/concepts/C-AM-08"
            order={8}
            title="Carrier mismatch and debugging"
            titleOr={long ? LONG_ODIA : 'Carrier mismatch ଓ Debugging'}
            status="not_started"
            next
            requiredForLab
          />
          <MapNode
            to="/concepts/C-AM-05"
            order={5}
            title="SSB and VSB compared with DSB-SC"
            status="revisit"
            rings={{ concept: { done: 2, total: 5 } }}
          />
          <MapNode
            to="/concepts/C-AM-09"
            order={9}
            title="Frequency modulation and deviation"
            titleOr="Frequency modulation ଓ Deviation"
            status="learning"
          />
        </div>
        <div className={styles.list}>
          <MapNode
            layout="row"
            to="/concepts/C-AM-07"
            order={7}
            title="Lowpass filtering and waveform comparison"
            titleOr="Lowpass filtering ଓ Waveform ତୁଳନା"
            status="passed"
            rings={{ concept: { done: 5, total: 5 } }}
            requiredForLab
          />
          <MapNode
            layout="row"
            to="/concepts/C-AM-08"
            order={8}
            title="Carrier mismatch and debugging"
            titleOr={long ? LONG_ODIA : 'Carrier mismatch ଓ Debugging'}
            status="not_started"
            next
            requiredForLab
          />
          <MapNode
            layout="row"
            to="/concepts/C-AM-05"
            order={5}
            title="SSB and VSB compared with DSB-SC"
            status="revisit"
            rings={{ concept: { done: 2, total: 5 } }}
          />
        </div>
      </Section>

      <Section title="LoadingState and ErrorState">
        {long ? (
          <div lang="or">
            <LoadingState message={LONG_ODIA} />
          </div>
        ) : (
          <LoadingState message="Loading your chapter…" />
        )}
        <ErrorState message="No signal. Your progress is saved on this phone." />
        <ErrorState
          message={
            retries
              ? `Still no connection (tried ${retries} ${retries === 1 ? 'time' : 'times'}).`
              : "Couldn't load the lesson. Check your connection."
          }
          onRetry={() => setRetries((n) => n + 1)}
        />
        {long && (
          <div lang="or">
            <ErrorState message={LONG_ODIA} onRetry={() => setRetries((n) => n + 1)} />
          </div>
        )}
      </Section>
    </div>
  )
}
