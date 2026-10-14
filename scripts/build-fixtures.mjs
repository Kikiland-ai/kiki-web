#!/usr/bin/env node
/**
 * Builds the labelled lesson and lab fixture from the Analog Modulation content.
 *
 *   node scripts/build-fixtures.mjs <path to Design-Thinking/data-model>
 *
 * Reads ledgers/electronics/analog-modulation.json and
 * cases/analog-modulation-odia.json, maps them onto the contract types in
 * src/contracts/api.ts and writes src/fixtures/analog-modulation.json.
 *
 * The output holds no questions, answers or learner responses: those stay on
 * the server (contract §6). The script refuses to write if an answer-like
 * field appears. Where the content has no Odia text, the English is reused
 * and the fallback is listed in meta.notes.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataModel = process.argv[2]
if (!dataModel) {
  console.error('Usage: node scripts/build-fixtures.mjs <path to Design-Thinking/data-model>')
  process.exit(1)
}

const LEDGER = 'ledgers/electronics/analog-modulation.json'
const CASE = 'cases/analog-modulation-odia.json'
const PLACARD_ORDER = ['definition', 'concept', 'application', 'recap']
/** Keys that would leak answers or learner data into the browser. */
const FORBIDDEN_KEY = /answer|correct|optionIndex|responses|quizRuns|questionIds|misconception/i

function load(relative) {
  const raw = readFileSync(join(dataModel, relative))
  return { json: JSON.parse(raw.toString('utf8')), sha256: createHash('sha256').update(raw).digest('hex') }
}

const ledgerFile = load(LEDGER)
const caseFile = load(CASE)
const ledger = ledgerFile.json
const content = caseFile.json
const notes = []

const plan = ledger.lessonPlan
const practical = content.practical
const conceptCheck = new Map(content.assessments.concepts.map((a) => [a.conceptIds[0], a.id]))
const odiaConcept = new Map(content.conceptTranslations.filter((t) => t.language === 'or').map((t) => [t.conceptId, t]))
const termExample = new Map(content.glossaryExamples.map((g) => [g.termId, g.sentence]))
const termsById = new Map(ledger.terms.map((t) => [t.id, t]))

/** English and Odia; reuses the English (and notes it) when the Odia is missing. */
function bilingual(en, or, what) {
  if (!or) notes.push(`No Odia for ${what}; English used in both.`)
  return { en, or: or ?? en }
}

function lessonTerm(id) {
  const t = termsById.get(id)
  if (!t) throw new Error(`Unknown term ${id}`)
  const example = termExample.get(id)
  return {
    id: t.id,
    term: t.term,
    definition: t.definition,
    ...(t.pronunciations?.or && { pronunciationOr: t.pronunciations.or }),
    ...(t.glosses?.or && { glossOr: t.glosses.or }),
    ...(example && { example: { en: example.en, or: example.or } }),
  }
}

const chapter = {
  planId: plan.id,
  courseId: plan.courseId,
  title: bilingual(plan.title, undefined, `chapter title "${plan.title}"`),
  broadConcepts: ledger.broadConcepts.map((b) => ({
    id: b.id,
    title: bilingual(b.title, undefined, `broad concept ${b.id}`),
    order: b.order,
  })),
  concepts: ledger.concepts.map((c) => ({
    id: c.id,
    order: c.order,
    broadConceptId: c.broadConceptId,
    title: bilingual(c.title, odiaConcept.get(c.id)?.title, `concept title ${c.id}`),
    canDo: c.canDo,
    prerequisiteIds: c.prerequisiteIds,
    requiredForLab: practical.requiredConceptIds.includes(c.id),
    estMinutes: c.estMinutes,
    assessmentId: conceptCheck.get(c.id),
  })),
  chapterAssessmentId: content.assessments.chapter.id,
  practicalId: practical.practicalId,
  review: {
    content: content.contentReview.status === 'reviewed' ? 'reviewed' : 'draft',
    odia: content.odiaReview.nativeSpeakerReviewed ? 'reviewed' : 'draft',
  },
}

const lessons = Object.fromEntries(
  ledger.concepts.map((c) => {
    const or = odiaConcept.get(c.id)
    const placards = content.placards
      .filter((p) => p.conceptId === c.id)
      .sort((a, b) => PLACARD_ORDER.indexOf(a.kind) - PLACARD_ORDER.indexOf(b.kind))
      .map((p) => ({ id: p.id, kind: p.kind, title: p.title, body: p.body, termIds: p.termIds, sources: p.sources }))
    if (placards.map((p) => p.kind).join() !== PLACARD_ORDER.join()) {
      throw new Error(`${c.id} needs exactly four placards in order: ${PLACARD_ORDER.join(', ')}`)
    }
    const termIds = [...new Set([...c.termIds, ...placards.flatMap((p) => p.termIds)])]
    const lesson = {
      conceptId: c.id,
      planId: plan.id,
      title: bilingual(c.title, or?.title, `concept title ${c.id}`),
      keyIdea: bilingual(c.explanation.keyIdea, undefined, `key idea ${c.id}`),
      placards,
      terms: termIds.map(lessonTerm),
      example: {
        title: bilingual(c.example.title, or?.example?.title, `example title ${c.id}`),
        scenario: bilingual(c.example.scenario, or?.example?.scenario, `example scenario ${c.id}`),
        takeaway: bilingual(c.example.takeaway, or?.example?.takeaway, `example takeaway ${c.id}`),
      },
      media: { status: 'none' },
      assessmentId: conceptCheck.get(c.id),
    }
    return [c.id, lesson]
  }),
)

const lab = {
  practicalId: practical.practicalId,
  title: ledger.practicals.find((p) => p.id === practical.practicalId)?.title ?? practical.practicalId,
  requiredConceptIds: practical.requiredConceptIds,
  executionVerified: practical.executionVerified === true,
  checkpoints: practical.checkpoints.map((cp) => ({
    id: cp.id,
    stepNumber: cp.stepNumber,
    targetLabel: cp.target.label,
    instruction: cp.instruction,
    why: cp.why,
    expected: cp.expected,
    evidenceKind: cp.evidenceKind,
    prerequisiteCheckpointIds: cp.prerequisiteCheckpointIds,
  })),
  observationPrompts: practical.observationPrompts,
}

const output = {
  meta: {
    fixture: true,
    label: 'Fixture data: draft Analog Modulation content and a synthetic learner. Not live results.',
    generatedBy: 'scripts/build-fixtures.mjs',
    sources: { [LEDGER]: ledgerFile.sha256, [CASE]: caseFile.sha256 },
    notes: [...new Set(notes)],
  },
  chapter,
  lessons,
  lab,
}

// Guard: no answer keys, questions or learner responses may reach the browser
;(function check(value, path) {
  if (Array.isArray(value)) return value.forEach((v, i) => check(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) throw new Error(`Refusing to write: answer-like key "${key}" at ${path}`)
      check(v, `${path}.${key}`)
    }
  }
})(output, 'fixture')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'src/fixtures/analog-modulation.json')
writeFileSync(target, JSON.stringify(output, null, 2) + '\n')
console.log(
  `Wrote ${target}: ${chapter.concepts.length} concepts, ${Object.keys(lessons).length} lessons, ` +
    `${lab.checkpoints.length} checkpoints, ${output.meta.notes.length} Odia fallbacks.`,
)
