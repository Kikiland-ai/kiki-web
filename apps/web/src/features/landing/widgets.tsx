import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'motion/react'
import { Icon } from '../../ui/kit'
import type { PageCopy } from './copy'
import { SAMPLE } from './sample'
import styles from './Landing.module.css'

/*
 * The landing page's animated widgets. Rules: one thing to look at per widget, a plain caption
 * for what is happening, slow steps the visitor can click, and no fast loops. Real content comes
 * from sample.ts; anything not built yet is labelled on the page. With reduced motion every
 * widget shows its finished state.
 */

/**
 * Steps 0..count-1 once, `ms` apart, while `active`. Clicking a step (goTo) pauses it.
 * With reduced motion it rests on the last step.
 */
function useStepper(active: boolean, count: number, ms: number, loop = false, resetWhenHidden = false) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    if (active || !resetWhenHidden) return
    const id = window.setTimeout(() => { setStep(0); setPlaying(true) }, 300)
    return () => window.clearTimeout(id)
  }, [active, resetWhenHidden])
  useEffect(() => {
    if (!active || reduce || !playing) return
    const id = window.setTimeout(() => {
      if (step + 1 < count) setStep(step + 1)
      else if (loop) setStep(0)
      else setPlaying(false)
    }, ms)
    return () => window.clearTimeout(id)
  }, [active, reduce, playing, step, count, ms, loop])
  return {
    step: reduce ? count - 1 : step,
    playing: playing && !reduce,
    goTo: (n: number) => { setStep(n); setPlaying(false) },
    toggle: () => { if (!playing && step + 1 >= count) setStep(0); setPlaying(!playing) },
    replay: () => { setStep(0); setPlaying(true) },
  }
}

function escape(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/** Wraps the English technical terms of a sentence so they can light up. */
function Terms({ text, terms, on }: { text: string; terms: readonly string[]; on: boolean }) {
  const re = new RegExp(`(${[...terms].sort((a, b) => b.length - a.length).map(escape).join('|')})`, 'g')
  return <>{text.split(re).map((part, i) => (terms.includes(part)
    ? <span key={i} lang="en" className={`${styles.term} ${on ? styles.termOn : ''}`}>{part}</span>
    : <span key={i}>{part}</span>))}</>
}

/** Fades and lifts its children in once, when scrolled into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  )
}

/** HERO: a real textbook sentence becomes the student's language, English terms kept. */
export function TransformCard({ t }: { t: PageCopy['hero']['transform'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const { step: stage } = useStepper(inView, 4, 2400, true)
  const r = SAMPLE.recap
  return (
    <div ref={ref} className={styles.transform} aria-label={`${t.source} → ${t.mixed}`}>
      <div className={styles.tfBlock}>
        <span className={styles.tfLabel}>{t.source}</span>
        <p lang="en" className={styles.tfSource}><Terms text={r.en} terms={r.terms} on={stage >= 1} /></p>
      </div>
      <div className={styles.tfFlow} aria-hidden="true">
        <svg viewBox="0 0 400 60" preserveAspectRatio="none">
          <motion.path d="M0 10 C 120 10, 140 50, 200 50 S 300 10, 400 10" fill="none" strokeWidth="3" className={styles.tfPath}
            initial={{ pathLength: 0 }} animate={{ pathLength: stage >= 2 ? 1 : 0.15 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
        </svg>
        <motion.span className={styles.tfKept} animate={{ opacity: stage >= 1 ? 1 : 0, scale: stage >= 1 ? 1 : 0.9 }}><Icon name="lock" />{t.kept}</motion.span>
      </div>
      <motion.div className={`${styles.tfBlock} ${styles.tfOut}`} animate={{ opacity: stage >= 2 ? 1 : 0.15, y: stage >= 2 ? 0 : 8 }} transition={{ duration: 0.7 }}>
        <span className={styles.tfLabel}>{t.mixed}</span>
        <p lang="or" className={styles.tfMixed}><Terms text={r.mixed} terms={r.terms} on={stage >= 2} /></p>
      </motion.div>
      <p className={styles.tfCaption}>{t.caption}</p>
    </div>
  )
}

/** THE STUDENT: everything around them flips language, one row at a time. */
export function StudentFlip({ t }: { t: PageCopy['student'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    if (!inView) return
    const id = window.setTimeout(() => setFlipped(true), reduce ? 0 : 900)
    return () => window.clearTimeout(id)
  }, [inView, reduce])
  return (
    <div ref={ref} className={styles.flip}>
      <div className={styles.flipHead}><span>{flipped ? t.to : t.from}</span></div>
      <ul>
        {t.rows.map((row, i) => (
          <li key={row}>
            <span>{row}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={flipped ? 'to' : 'from'} className={`${styles.flipChip} ${flipped ? styles.flipTo : styles.flipFrom}`}
                initial={{ opacity: 0, rotateX: -90 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0, rotateX: 90 }}
                transition={{ duration: 0.35, delay: flipped ? i * 0.45 : 0 }}>
                {flipped ? t.toValue : t.fromValue}
              </motion.span>
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Bar({ value, tone }: { value: number; tone: 'concept' | 'english' | 'words' | 'lab' }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <motion.span className={styles[`bar_${tone}`]} initial={{ width: 0 }} whileInView={{ width: `${value * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }} />
    </span>
  )
}

/** LEARN: tap a technical term to see its sound, meaning and English definition. */
export function Glossary({ t }: { t: PageCopy['learn'] }) {
  const [i, setI] = useState(0)
  const g = SAMPLE.glossary[i]
  return (
    <div className={styles.glossary}>
      <span className={styles.cardLabel}>{t.glossaryTitle}</span>
      <div className={styles.glossTerms}>
        {SAMPLE.glossary.map((item, n) => (
          <button key={item.term} type="button" lang="en" aria-pressed={n === i} className={`${styles.term} ${n === i ? styles.termOn : ''}`} onClick={() => setI(n)}>{item.term}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.dl key={g.term} className={styles.glossCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          <div><dt>{t.glossary.sound}</dt><dd lang="or">{g.sound}</dd></div>
          <div><dt>{t.glossary.meaning}</dt><dd lang="or">{g.meaning}</dd></div>
          <div><dt>{t.glossary.definition}</dt><dd lang="en">{g.definition}</dd></div>
        </motion.dl>
      </AnimatePresence>
    </div>
  )
}

/** LEARN: the language dial, shown at the two ends that exist for one real lesson card. */
export function Dial({ t }: { t: PageCopy['learn'] }) {
  const [end, setEnd] = useState(0)
  const a = SAMPLE.application
  return (
    <div className={styles.dialBox}>
      <span className={styles.cardLabel}>{t.dialTitle}</span>
      <div className={styles.dialTrack} role="group" aria-label={t.dialTitle}>
        {t.dialEnds.map((label, n) => (
          <button key={label} type="button" aria-pressed={end === n} onClick={() => setEnd(n)}>
            {end === n && <motion.span layoutId="dial-knob" className={styles.dialKnob} transition={{ type: 'spring', stiffness: 320, damping: 30 }} />}
            <span className={styles.toggleText}>{label}</span>
          </button>
        ))}
        <span className={styles.dialTicks} aria-hidden="true"><i /><i /><i /><i /><i /></span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={end} lang={end ? 'en' : 'or'} className={styles.dialText} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Terms text={end ? a.en : a.mixed} terms={a.terms} on />
        </motion.p>
      </AnimatePresence>
      <p className={styles.small}>{t.dialNote}</p>
    </div>
  )
}

/** PROVE: an answer marked twice, with the repair map (design mock-up). */
export function SplitMarks({ t }: { t: PageCopy['prove'] }) {
  return (
    <div className={styles.split2}>
      <div className={styles.skillRow}><span>{t.concept}</span><Bar value={0.8} tone="concept" /><b>4 / 5</b></div>
      <div className={styles.skillRow}><span>{t.english}</span><Bar value={0.4} tone="english" /><b>2 / 5</b></div>
      <span className={styles.cardLabel}>{t.repair}</span>
      <ul className={styles.wordChips}>{t.words.map((w, i) => <motion.li key={w} lang="en" initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.2 }}>{w}</motion.li>)}</ul>
      <p className={styles.small}>{t.mock}</p>
    </div>
  )
}

/** Where to look on the real lab screenshot in each phase, as % of the image. */
const LAB_SPOTS = [
  { left: 75.5, top: 16, width: 23.5, height: 22 }, // Look: KiKi's NOW card
  { left: 75.5, top: 33, width: 23.5, height: 8 }, // Why: Step details
  { left: 32, top: 66, width: 30, height: 34 }, // Do: the student's model
  { left: 75.5, top: 51, width: 23.5, height: 30 }, // Check: What I can see
]
const LAB_STEP_MS = 4500

/**
 * DO: one real checkpoint from the lab trial, played by itself. Each phase holds long enough to
 * read; the spotlight on the screenshot (tagged with the phase name) and the step list on the right
 * always show the same phase. It restarts whenever it comes back into view, and loops.
 */
export function LabReplay({ t, image, size }: { t: PageCopy['do']; image: string; size: readonly [number, number] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.6 })
  const s = useStepper(inView, t.phases.length + 1, LAB_STEP_MS, true, true)
  const finished = s.step >= t.phases.length
  const spot = LAB_SPOTS[Math.min(s.step, LAB_SPOTS.length - 1)]
  return (
    <div ref={ref} className={styles.replay}>
      <div className={styles.replayStage}>
        <img src={image} width={size[0]} height={size[1]} alt={t.alt} loading="lazy" lang="en" />
        <motion.div className={`${styles.spot} ${finished ? styles.spotOff : ''}`} aria-hidden="true"
          animate={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, height: `${spot.height}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}>
          {!finished && <span className={styles.spotTag}>{s.step + 1} · {t.phases[s.step][0]}</span>}
        </motion.div>
      </div>
      <div className={styles.replaySide}>
        <p className={styles.replayNow}>{t.current}</p>
        <ol className={styles.phaseList}>
          {t.phases.map(([label, detail], n) => {
            const state = n < s.step ? 'done' : n === s.step ? 'now' : 'next'
            return (
              <li key={label} className={styles[`ph_${state}`]} aria-current={state === 'now' ? 'step' : undefined}>
                <div className={styles.phaseHead}>
                  <span className={styles.phaseBadge}>{state === 'done' ? <Icon name="check" /> : n + 1}</span>
                  <strong>{label}</strong>
                </div>
                <AnimatePresence initial={false}>
                  {state === 'now' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35 }} className={styles.phaseBody}>
                      <p>{detail}</p>
                      {s.playing && <span className={styles.phaseTimer}><motion.span key={s.step} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: LAB_STEP_MS / 1000, ease: 'linear' }} /></span>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ol>
        <div className={styles.trialBar}>
          <span>{t.progress}</span>
          <span className={styles.bar} aria-hidden="true"><motion.span className={styles.bar_lab} animate={{ width: `${((finished ? SAMPLE.trialReached : 5) / 12) * 100}%` }} transition={{ duration: 1 }} /></span>
          <AnimatePresence>{finished && <motion.b initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{t.reached}</motion.b>}</AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/**
 * WHY YOU CAN TRUST IT: the life of a lesson in four stages, Plan → Make → Check → Guide. A spine
 * across the top shows where the reader is (it advances by itself; any stage can be clicked).
 * Each stage has one full-sentence headline and its own visual form: a tree, a conveyor, a filter
 * and a cycle. One concept, Carrier mismatch, and its term "frequency mismatch" run through all four.
 */
const STAGE_MS = 10000
const STAGE_TONES = ['concept', 'words', 'english', 'lab'] as const

export function SystemStory({ t }: { t: PageCopy['system'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const s = useStepper(inView, 4, STAGE_MS, true, true)
  const stages = [t.plan, t.make, t.check, t.guide]
  const cur = stages[s.step]
  return (
    <div ref={ref} className={styles.story}>
      <ol className={styles.spine} aria-label={t.title}>
        {stages.map((x, i) => (
          <li key={x.name} className={`${styles[`tone_${STAGE_TONES[i]}`]} ${i === s.step ? styles.spineOn : i < s.step ? styles.spineDone : ''}`}>
            <button type="button" aria-current={i === s.step ? 'step' : undefined} onClick={() => s.goTo(i)}>
              <span className={styles.spineNum}>{i + 1}</span>{x.name}
            </button>
            {i === s.step && s.playing && <span className={styles.spineTimer}><motion.span key={s.step} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: STAGE_MS / 1000, ease: 'linear' }} /></span>}
          </li>
        ))}
      </ol>
      <p className={styles.thread}><span className={styles.threadDot} />{t.thread}</p>
      <AnimatePresence mode="wait">
        <motion.div key={s.step} className={`${styles.stage} ${styles[`tone_${STAGE_TONES[s.step]}`]}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
          <h3 className={styles.stageHead}>{cur.headline}</h3>
          {s.step === 0 && <PlanTree t={t.plan} />}
          {s.step === 1 && <MakeConveyor t={t.make} />}
          {s.step === 2 && <CheckFilter t={t.check} />}
          {s.step === 3 && <GuideCycle t={t.guide} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// Plan · tree chart geometry (SVG units)
const T_COL = (g: number) => 95 + g * 190
const T_LEAF_W = 164
const T_LEAF_H = 30
const T_LEAF_Y = (k: number) => 142 + k * 42
const PATH = [1, 2, 3, 4, 6, 7, 8]
const THREAD_ID = 8

/** PLAN: chapter → parts → concepts as a tree; then the learning path lights up into the lab. */
function PlanTree({ t }: { t: PageCopy['system']['plan'] }) {
  const reduce = useReducedMotion()
  const d = (n: number) => (reduce ? 0 : n)
  const rows = new Map<number, number>()
  for (let g = 0; g < 4; g++) SAMPLE.concepts.filter((c) => c.group === g).forEach((c, k) => rows.set(c.id, k))
  const leaf = (id: number) => { const c = SAMPLE.concepts[id - 1]; return { x: T_COL(c.group) - T_LEAF_W / 2, y: T_LEAF_Y(rows.get(id)!) } }
  const lab = { x: T_COL(3) - T_LEAF_W / 2, y: T_LEAF_Y(2) + 8, w: T_LEAF_W, h: 34 }
  const pts = PATH.map((id) => { const l = leaf(id); return [l.x + T_LEAF_W / 2, l.y + T_LEAF_H / 2] as const })
  const route = `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} L${lab.x + lab.w / 2} ${lab.y + lab.h / 2}`
  const th = leaf(THREAD_ID)
  return (
    <div className={styles.visual}>
      <div className={styles.scrollX} tabIndex={0} role="region" aria-label={t.note}>
        <svg viewBox="0 0 760 300" role="img" lang="en" aria-label={`${SAMPLE.chapter}: ${SAMPLE.parts.join(', ')}. ${t.path}: ${PATH.map((id) => SAMPLE.concepts[id - 1].name).join(' → ')} → ${t.lab}.`}>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(0.1) }}>
            <rect x="290" y="6" width="180" height="36" rx="8" className={styles.trRoot} />
            <text x="380" y="29" textAnchor="middle" className={styles.trRootText}>{SAMPLE.chapter}</text>
          </motion.g>
          {SAMPLE.parts.map((part, g) => (
            <motion.g key={part} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(0.6 + g * 0.15) }}>
              <path d={`M380 42 V56 H${T_COL(g)} V72`} className={styles.trLine} fill="none" />
              <rect x={T_COL(g) - 75} y="72" width="150" height="28" rx="6" className={styles.trPart} />
              <text x={T_COL(g)} y="91" textAnchor="middle" className={styles.trPartText}>{part}</text>
              <path d={`M${T_COL(g)} 100 V${T_LEAF_Y(SAMPLE.concepts.filter((c) => c.group === g).length - 1) + T_LEAF_H / 2}`} className={styles.trLine} fill="none" />
            </motion.g>
          ))}
          <motion.path d={route} fill="none" className={styles.trRoute} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: d(2.6), duration: d(2.4), ease: 'easeInOut' }} />
          {SAMPLE.concepts.map((c, n) => {
            const l = leaf(c.id)
            const onPath = PATH.includes(c.id as (typeof PATH)[number])
            return (
              <motion.g key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(1.4 + n * 0.08) }}>
                <rect x={l.x} y={l.y} width={T_LEAF_W} height={T_LEAF_H} rx="7" className={onPath ? styles.trLeafPath : styles.trLeafSide} />
                <text x={l.x + T_LEAF_W / 2} y={l.y + 20} textAnchor="middle" className={styles.trLeafText}>{c.name}</text>
              </motion.g>
            )
          })}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(5) }}>
            <rect x={lab.x} y={lab.y} width={lab.w} height={lab.h} rx="8" className={styles.trLab} />
            <text x={lab.x + lab.w / 2} y={lab.y + 22} textAnchor="middle" className={styles.trLabText}>{t.lab}</text>
          </motion.g>
          <motion.rect x={th.x - 5} y={th.y - 5} width={T_LEAF_W + 10} height={T_LEAF_H + 10} rx="10" className={styles.threadRing}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1] }} transition={{ delay: d(5.6), duration: d(1.6) }} />
        </svg>
      </div>
      <p className={styles.visualNote}><span className={styles.keyPath} />{t.path} · {t.note}</p>
    </div>
  )
}

/** MAKE: one sentence travels along a conveyor of stations; the English term rides through locked. */
function MakeConveyor({ t }: { t: PageCopy['system']['make'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const { step } = useStepper(inView, t.stations.length, 1500)
  const r = SAMPLE.recap
  const icons = ['description', 'translate', 'check_circle', 'translate', 'check_circle', 'lock'] as const
  return (
    <div ref={ref} className={styles.visual}>
      <ol className={styles.belt}>
        {t.stations.map((x, i) => (
          <li key={`${x}-${i}`} className={`${i <= step ? styles.beltOn : ''} ${i === 2 || i === 4 ? styles.beltGate : ''}`}>
            <span className={styles.beltIcon}><Icon name={icons[i]} /></span>
            <span>{x}</span>
            {i === step && <motion.span layoutId="belt-cursor" className={styles.beltCursor} transition={{ type: 'spring', stiffness: 140, damping: 22 }} />}
          </li>
        ))}
      </ol>
      <div className={styles.parcel}>
        <AnimatePresence mode="wait">
          <motion.p key={step < 1 ? 'en' : 'or'} lang={step < 1 ? 'en' : 'or'} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.3 }}>
            <Terms text={step < 1 ? r.en : r.mixed} terms={r.terms} on={step === 0 || step >= 3} />
          </motion.p>
        </AnimatePresence>
        {step >= t.stations.length - 1 && <motion.span className={styles.parcelLock} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}><Icon name="lock" />{t.locked}</motion.span>}
      </div>
      <div className={styles.rail}>
        <motion.span lang="en" className={`${styles.term} ${styles.termOn} ${styles.railToken}`} animate={{ left: `${(step / (t.stations.length - 1)) * 100}%`, x: `-${(step / (t.stations.length - 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 140, damping: 22 }}>
          <Icon name="lock" />Frequency mismatch
        </motion.span>
        <span className={styles.railLabel}>{t.kept}</span>
      </div>
    </div>
  )
}

/** CHECK: lessons pass three gates; each gate catches one kind of error; the thread lesson comes out reviewed. */
function CheckFilter({ t }: { t: PageCopy['system']['check'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const { step } = useStepper(inView, t.gates.length + 2, 1700)
  return (
    <div ref={ref} className={styles.visual}>
      <div className={styles.filter}>
        <div className={styles.filterCol}>
          <span className={styles.filterHead}>{t.drafts}</span>
          {step === 0 && <motion.span layoutId="check-item" className={styles.filterItem} lang="en">Carrier mismatch</motion.span>}
          <span className={styles.filterGhost} aria-hidden="true" /><span className={styles.filterGhost} aria-hidden="true" /><span className={styles.filterGhost} aria-hidden="true" />
        </div>
        {t.gates.map(([name, checks, caught], i) => (
          <div key={name} className={`${styles.filterCol} ${styles.gateCol} ${step > i ? styles.gatePassed : ''}`}>
            <span className={styles.filterHead}>{name}</span>
            <span className={styles.gateWhat}>{checks}</span>
            {step === i + 1 && <motion.span layoutId="check-item" className={styles.filterItem} lang="en">Carrier mismatch</motion.span>}
            <AnimatePresence>{step > i && <motion.span className={styles.caught} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}><Icon name="close" />{caught}</motion.span>}</AnimatePresence>
          </div>
        ))}
        <div className={`${styles.filterCol} ${styles.filterOut}`}>
          <span className={styles.filterHead}><Icon name="check_circle" />{t.passed}</span>
          {step >= t.gates.length + 1 && <motion.span layoutId="check-item" className={`${styles.filterItem} ${styles.filterDone}`} lang="en"><Icon name="check" />Carrier mismatch</motion.span>}
        </div>
      </div>
      <p className={styles.visualNote}>{t.note}</p>
    </div>
  )
}

/** GUIDE: the lab loop as a cycle; a marker travels round, lighting each stage in turn. */
function GuideCycle({ t }: { t: PageCopy['system']['guide'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const reduce = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView || reduce) return
    const id = window.setInterval(() => setN((v) => v + 1), 2200)
    return () => window.clearInterval(id)
  }, [inView, reduce])
  const active = n % 4
  const C = { x: 380, y: 150, r: 108 }
  const nodes = t.loop.map((label, i) => {
    const a = (-90 + i * 90) * (Math.PI / 180)
    return { label, x: C.x + C.r * Math.cos(a), y: C.y + C.r * Math.sin(a), anchor: (i === 1 ? 'start' : i === 3 ? 'end' : 'middle') as 'start' | 'end' | 'middle', dx: i === 1 ? 24 : i === 3 ? -24 : 0, dy: i === 0 ? -22 : i === 2 ? 34 : 5 }
  })
  return (
    <div ref={ref} className={styles.visual}>
      <div className={styles.scrollX} tabIndex={0} role="region" aria-label={t.loop.join(' → ')}>
        <svg viewBox="0 0 760 310" role="img" aria-label={`${t.loop.join(' → ')}. ${t.center.join(': ')}.`}>
          <circle cx={C.x} cy={C.y} r={C.r} className={styles.cyRing} />
          {[0, 1, 2, 3].map((i) => { const a = (-45 + i * 90) * (Math.PI / 180); return <path key={i} d={`M${C.x + C.r * Math.cos(a) - 6} ${C.y + C.r * Math.sin(a)} l6 0 l0 0`} className={styles.cyRing} /> })}
          {(() => {
            const at = (k: number) => { const a = (-90 + k * 90) * (Math.PI / 180); return `${C.x + C.r * Math.cos(a)} ${C.y + C.r * Math.sin(a)}` }
            return <motion.path key={n} d={`M${at(active - 1)} A ${C.r} ${C.r} 0 0 1 ${at(active)}`} className={styles.cyArc} initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
          })()}
          {nodes.map((nd, i) => (
            <g key={nd.label}>
              <circle cx={nd.x} cy={nd.y} r="16" className={i === active ? styles.cyNodeOn : styles.cyNode} />
              <text x={nd.x} y={nd.y + 5} textAnchor="middle" className={i === active ? styles.cyNumOn : styles.cyNum}>{i + 1}</text>
              <text x={nd.x + nd.dx} y={nd.y + nd.dy} textAnchor={nd.anchor} className={i === active ? styles.cyLabelOn : styles.cyLabel}>{nd.label}</text>
            </g>
          ))}
          <text x={C.x} y={C.y - 4} textAnchor="middle" className={styles.cyCenter}>{t.center[0]}</text>
          <text x={C.x} y={C.y + 18} textAnchor="middle" className={styles.cyCenterSub}>{t.center[1]}</text>
        </svg>
      </div>
      <p className={styles.visualNote}>{t.stat}</p>
    </div>
  )
}

/** PROOF: numbers count up once, when seen. Non-numeric figures show as they are. */
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const m = /^(\d+(?:\.\d+)?)(.*)$/.exec(value)
  useEffect(() => {
    if (!m || !inView || reduce || !ref.current) return
    const target = Number(m[1]); const decimals = m[1].includes('.') ? 1 : 0; const tail = m[2]; const el = ref.current
    const controls = animate(0, target, { duration: 1.4, ease: 'easeOut', onUpdate: (v) => { el.textContent = `${v.toFixed(decimals)}${tail}` } })
    return () => controls.stop()
  }, [inView, reduce, m?.[1], m?.[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  return <strong ref={ref}>{value}</strong>
}
