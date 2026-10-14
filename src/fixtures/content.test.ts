import { describe, expect, it } from 'vitest'
import { loadFixtureContent } from './content'

describe('generated fixture content', () => {
  it('is labelled as fixture data and built from the agreed content version (contract §11)', async () => {
    const { meta } = await loadFixtureContent()
    expect(meta.fixture).toBe(true)
    expect(meta.label).toMatch(/Fixture data/)
    expect(meta.sources).toEqual({
      'ledgers/electronics/analog-modulation.json': 'efbd9786f1c3ca1ebaac49a729355baa856042d576b275eb8c1e6828c47e8416',
      'cases/analog-modulation-odia.json': '994a730773354e03896d8c6489a12699d85f54a2ee2fd0ef2ee255cc00a74187',
    })
  })

  it('holds no questions, answers or learner responses', async () => {
    const content = await loadFixtureContent()
    const keys: string[] = []
    ;(function walk(v: unknown) {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          keys.push(k)
          walk(x)
        }
      }
    })(content)
    expect(keys.filter((k) => /answer|correct|optionIndex|responses|quizRuns|questionIds/i.test(k))).toEqual([])
  })

  it('has the ten-concept chapter with the seven lab concepts', async () => {
    const { chapter, lab } = await loadFixtureContent()
    expect(chapter.planId).toBe('LP-ANALOG-MODULATION')
    expect(chapter.concepts.map((c) => c.id)).toEqual(Array.from({ length: 10 }, (_, i) => `C-AM-${String(i + 1).padStart(2, '0')}`))
    expect(chapter.concepts.filter((c) => c.requiredForLab).map((c) => c.id)).toEqual([
      'C-AM-01',
      'C-AM-02',
      'C-AM-03',
      'C-AM-04',
      'C-AM-06',
      'C-AM-07',
      'C-AM-08',
    ])
    expect(lab.requiredConceptIds).toHaveLength(7)
    expect(chapter.chapterAssessmentId).toBe('AS-AM-CHAPTER')
    expect(chapter.concepts.find((c) => c.id === 'C-AM-08')?.assessmentId).toBe('AS-AM-08')
    expect(chapter.review).toEqual({ content: 'draft', odia: 'draft' })
  })

  it('gives every lesson four placards in order, and every placard term is in the lesson', async () => {
    const { lessons } = await loadFixtureContent()
    expect(Object.keys(lessons)).toHaveLength(10)
    for (const lesson of Object.values(lessons)) {
      expect(lesson.placards.map((p) => p.kind)).toEqual(['definition', 'concept', 'application', 'recap'])
      const termIds = new Set(lesson.terms.map((t) => t.id))
      for (const p of lesson.placards) for (const id of p.termIds) expect(termIds.has(id)).toBe(true)
      expect(lesson.title.or).toBeTruthy()
      expect(lesson.media.status).toBe('none')
    }
  })

  it('has term details for C-AM-08, including the Odia pronunciation and meaning', async () => {
    const { lessons } = await loadFixtureContent()
    const phaseError = lessons['C-AM-08'].terms.find((t) => t.id === 'T-AM-08-1')
    expect(phaseError).toMatchObject({ term: 'phase error', pronunciationOr: 'ଫେଜ୍ ଏରର୍' })
    expect(phaseError?.glossOr).toBeTruthy()
    expect(phaseError?.example?.en).toMatch(/90-degree/)
  })

  it('has the twelve DSB-SC checkpoints in order', async () => {
    const { lab } = await loadFixtureContent()
    expect(lab.practicalId).toBe('PR-AM-DSB')
    expect(lab.checkpoints.map((c) => c.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `CP-DSB-${String(i + 1).padStart(2, '0')}`),
    )
    expect(lab.checkpoints.map((c) => c.stepNumber)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  })
})
