import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { MotionConfig } from 'motion/react'
import { ModeNotice } from '../../app/Shell'
import { Icon, KikiDots, Wordmark } from '../../ui/kit'
import { useMediaQuery } from '../learning/useMediaQuery'
import { COPY, SCRIPTS, STUDENT_TRY_PATH, type PageCopy, type PageLang } from './copy'
import { CountUp, Dial, Glossary, LabReplay, Reveal, SplitMarks, StudentFlip, SystemStory, TransformCard } from './widgets'
import lessonClip from './media/narrated-lesson.mp4'
import lessonPoster from './media/poster.jpg'
import labGuide from './media/lab-guide.jpg'
import checkRevisit from './media/check-revisit.jpg'
import styles from './Landing.module.css'

const LANG_KEY = 'kiki:landing-lang:v1'
/** Where pilot requests go. Set per deployment (decision D8); without it the form says it can't send. */
const PILOT_CONTACT = (import.meta.env.VITE_PILOT_CONTACT as string | undefined)?.trim() || ''

function savedLang(): PageLang {
  try { return localStorage.getItem(LANG_KEY) === 'or' ? 'or' : 'en' } catch { return 'en' }
}

/**
 * The public landing page (storyline v3, revised), written for the buyer, colleges and state
 * technical-education departments, with the student as the hero. Product-first: the hook and the
 * student, what KiKi does (learn, prove, do), why you can trust it (the system, proof), the ask.
 * Odia is the first language built and appears only as the example. One goal: request a pilot.
 */
export function Landing() {
  const [lang, setLang] = useState<PageLang>(savedLang)
  const t = COPY[lang]
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  function switchLang() {
    const next = lang === 'en' ? 'or' : 'en'
    setLang(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* the choice just isn't remembered */ }
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className={styles.page} lang={lang}>
      <header className={styles.header}>
        <Link to="/" aria-label="KiKi home"><Wordmark /></Link>
        <nav className={styles.nav} aria-label="Page">
          <button type="button" className={styles.langSwitch} onClick={switchLang} aria-label={t.nav.switchLabel} lang={lang === 'en' ? 'or' : 'en'}>{t.nav.switchTo}</button>
          <Link className={styles.quietLink} to="/auth">{t.nav.student}</Link>
          <Cta compact>{t.nav.cta}</Cta>
        </nav>
      </header>
      <div className={styles.rainbow} aria-hidden="true" />
      <ModeNotice />
      {t.langNote && <p className={styles.langNote} role="note">{t.langNote} <span lang="en">Odia text is a machine draft awaiting native review.</span></p>}

      <main>
        {/* ACT 1 · THE HOOK. Hero: the hook, the promise, the one action, and the transformation */}
        <section className={styles.hero}>
          <div className={`${styles.inner} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <span className="eyebrow">{t.hero.eyebrow}</span>
              <p className={styles.hook}>{t.hero.hook}</p>
              <h1>{t.hero.line1a}<span className={styles.ownLang}>{t.hero.line1b}</span><br />{t.hero.line2}</h1>
              <p className={styles.lead}>{t.hero.sub}</p>
              <div className={styles.actions}>
                <Cta>{t.hero.cta}</Cta>
                <a className={styles.watch} href="#learn"><Icon name="play_arrow" />{t.hero.watch}</a>
              </div>
              <p className={styles.ctaNote}><Icon name="check_circle" />{t.hero.ctaNote}</p>
            </div>
            <TransformCard t={t.hero.transform} />
          </div>
          <div className={`${styles.inner} ${styles.scripts}`}>
            <p>{t.hero.languages}</p>
            <ul aria-hidden="true">{SCRIPTS.map(([name, code], i) => <li key={code} lang={code} style={{ animationDelay: `${i * 80}ms` }}>{name}</li>)}</ul>
          </div>
        </section>

        <Band tone="surface" label={t.student.title}>
          <div className={styles.studentGrid}>
            <div className={styles.stack}>
              <span className="eyebrow">{t.student.eyebrow}</span>
              <h2>{t.student.title}</h2>
              <Reveal><p className={styles.turn}>{t.student.close}</p></Reveal>
            </div>
            <StudentFlip t={t.student} />
          </div>
        </Band>

        {/* ACT 2 · WHAT KIKI DOES: learn, prove, do */}
        <Band id="learn" label={t.learn.title}>
          <ActHead eyebrow={t.learn.eyebrow} title={t.learn.title} />
          <p className={styles.body}>{t.learn.body}</p>
          <div className={styles.learnGrid}>
            <figure className={styles.heroMedia}>
              <video className={styles.video} src={lessonClip} poster={lessonPoster} muted loop playsInline autoPlay={!reduceMotion} controls={reduceMotion} preload="metadata" aria-label="Recording of a KiKi lesson: the phase scene and the Odia text follow the narration" />
              <figcaption>{t.learn.caption}</figcaption>
            </figure>
            <div className={styles.stack}>
              <Glossary t={t.learn} />
              <Dial t={t.learn} />
            </div>
          </div>
        </Band>

        <Band tone="surface" label={t.prove.title}>
          <ActHead eyebrow={t.prove.eyebrow} title={t.prove.title} />
          <div className={styles.split}>
            <div className={styles.stack}>
              <p className={styles.body}>{t.prove.body}</p>
              <SplitMarks t={t.prove} />
            </div>
            <div className={styles.stack}>
              <figure className={`${styles.shot} ${styles.words}`}><img src={checkRevisit} width={765} height={350} alt={t.prove.alt} loading="lazy" lang="en" /></figure>
              <p className={styles.small}>{t.prove.built}</p>
            </div>
          </div>
        </Band>

        <Band label={t.do.title}>
          <ActHead eyebrow={t.do.eyebrow} title={t.do.title} />
          <LabReplay t={t.do} image={labGuide} size={[1200, 457]} />
        </Band>

        {/* ACT 3 · WHY YOU CAN TRUST IT: the system behind every lesson, then proof */}
        <Band tone="wash" label={t.system.title}>
          <span className="eyebrow">{t.system.eyebrow}</span>
          <h2 className={styles.wideHead}>{t.system.title}</h2>
          <SystemStory t={t.system} />
        </Band>

        <Band tone="ink" label={t.proof.title}>
          <span className="eyebrow">{t.proof.eyebrow}</span>
          <h2>{t.proof.title}</h2>
          <ul className={styles.stats}>{t.proof.stats.map(([figure, label]) => <li key={label}><CountUp value={figure} /><span>{label}</span></li>)}</ul>
          <p className={styles.proofNote}>{t.proof.note}</p>
          <Cta onInk>{t.proof.cta}</Cta>
        </Band>

        {/* ACT 4 · THE ASK: a low-risk offer, the form, where it leads, and the last ask */}
        <Band id="pilot" tone="wash" label={t.pilot.title}>
          <div className={styles.split}>
            <div className={styles.stack}>
              <span className="eyebrow">{t.pilot.eyebrow}</span>
              <h2>{t.pilot.title}</h2>
              <ol className={styles.steps}>
                {t.pilot.steps.map(([title, body], i) => <li key={title}><span className={styles.stepNumber} aria-hidden="true">{i + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>)}
              </ol>
              <ul className={styles.terms}>{t.pilot.terms.map((term) => <li key={term}><Icon name="check" />{term}</li>)}</ul>
              <p className={styles.small}>{t.pilot.state}</p>
            </div>
            <PilotForm copy={t.form} />
          </div>
        </Band>

        <Band label={t.roadmap.title}>
          <span className="eyebrow">{t.roadmap.eyebrow}</span>
          <h2>{t.roadmap.title}</h2>
          <p className={styles.body}>{t.roadmap.intro}</p>
          <ol className={styles.roadmap}>
            {t.roadmap.phases.map(([phase, items]) => <li key={phase}><strong>{phase}</strong><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></li>)}
          </ol>
          <p className={styles.vision}>{t.roadmap.vision}</p>
          <p className={styles.tag}><Icon name="info" />{t.roadmap.label}</p>
        </Band>

        <Band tone="surface" label={t.trust.title}>
          <div className={styles.split}>
            <div className={styles.stack}><span className="eyebrow">{t.trust.eyebrow}</span><h2>{t.trust.title}</h2></div>
            <ul className={styles.trust}>{t.trust.points.map((p) => <li key={p}><Icon name="check" />{p}</li>)}</ul>
          </div>
        </Band>

        <Band tone="wash" label={t.close.title}>
          <div className={styles.close}>
            <KikiDots size={56} />
            <h2>{t.close.title}</h2>
            <Cta>{t.close.cta}</Cta>
          </div>
        </Band>
      </main>

      <footer className={styles.footer}>
        <Wordmark animate />
        <Link className={styles.quietLink} to={STUDENT_TRY_PATH}>{t.close.student}</Link>
        <span>{t.close.built}</span>
      </footer>
    </div>
    </MotionConfig>
  )
}

/** An act section's heading: the verb eyebrow and the headline. */
function ActHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></>
}

/** The one action on the page. Every instance goes to the pilot request form. */
function Cta({ children, compact = false, onInk = false }: { children: ReactNode; compact?: boolean; onInk?: boolean }) {
  return (
    <a className={`${styles.cta} ${compact ? styles.ctaCompact : ''} ${onInk ? styles.ctaOnInk : ''}`} href="#pilot-form">
      <span>{children}</span>{!compact && <Icon name="arrow_forward" />}
    </a>
  )
}

function Band({ id, tone = 'paper', label, children }: { id?: string; tone?: 'paper' | 'surface' | 'ink' | 'wash'; label: string; children: ReactNode }) {
  return (
    <section id={id} className={`${styles.band} ${styles[tone]}`} aria-label={label}>
      <div className={`${styles.inner} ${styles.bandInner}`}>{children}</div>
    </section>
  )
}

function PilotForm({ copy }: { copy: PageCopy['form'] }) {
  const id = useId()
  const [status, setStatus] = useState<'idle' | 'opened' | 'unconfigured'>('idle')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!PILOT_CONTACT) { setStatus('unconfigured'); return }
    const data = new FormData(e.currentTarget)
    const value = (k: string) => String(data.get(k) ?? '').trim()
    const body = [
      `Name: ${value('name')}`, `Role: ${value('role')}`, `College or department: ${value('institution')}`,
      `Email: ${value('email')}`, `First-year students: ${value('size') || 'not given'}`, '', value('message'),
    ].join('\n')
    window.location.href = `mailto:${encodeURIComponent(PILOT_CONTACT)}?subject=${encodeURIComponent(`KiKi pilot request: ${value('institution')}`)}&body=${encodeURIComponent(body)}`
    setStatus('opened')
  }
  const field = (name: string) => `${id}-${name}`
  return (
    <form id="pilot-form" className={styles.form} onSubmit={submit} aria-labelledby={field('title')}>
      <h3 id={field('title')}>{copy.title}</h3>
      <p className={styles.small}>{copy.intro}</p>
      <label htmlFor={field('name')}>{copy.name}<input id={field('name')} name="name" autoComplete="name" required /></label>
      <label htmlFor={field('role')}>{copy.role}<select id={field('role')} name="role" required defaultValue=""><option value="" disabled>{'—'}</option>{copy.roles.map((r) => <option key={r} lang="en">{r}</option>)}</select></label>
      <label htmlFor={field('institution')}>{copy.institution}<input id={field('institution')} name="institution" autoComplete="organization" required /></label>
      <label htmlFor={field('email')}>{copy.email}<input id={field('email')} name="email" type="email" autoComplete="email" required /></label>
      <label htmlFor={field('size')}>{copy.size}<input id={field('size')} name="size" inputMode="numeric" /></label>
      <label htmlFor={field('message')}>{copy.message}<textarea id={field('message')} name="message" rows={3} /></label>
      <button type="submit" className={styles.cta}><span>{copy.submit}</span><Icon name="arrow_forward" /></button>
      <p className={styles.small}>{copy.privacy}</p>
      <div role="status" aria-live="polite">
        {status === 'opened' && <p className={styles.formNote}>{copy.opened}</p>}
        {status === 'unconfigured' && <p className={`${styles.formNote} ${styles.formWarn}`} data-testid="pilot-contact-pending">{copy.notConfigured}</p>}
      </div>
    </form>
  )
}
