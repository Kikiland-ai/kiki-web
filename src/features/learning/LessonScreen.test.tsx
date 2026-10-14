import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import type { LearningApi } from '../../contracts'
import { createFixtureLearningApi, createFixtureStore, type FixtureStore } from '../../fixtures'
import { LessonScreen } from './LessonScreen'
import { setLearningApi } from './services'

let store: FixtureStore
let api: LearningApi

function renderLesson(path = '/concepts/C-AM-08', override?: LearningApi) {
  setLearningApi(override ?? api)
  const router = createMemoryRouter([{ path: 'concepts/:conceptId', element: <LessonScreen /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

const placard = () => screen.getByRole('article')
const setDial = (key: string) => fireEvent.keyDown(screen.getByRole('slider', { name: 'Language mix' }), { key })

beforeEach(() => {
  window.localStorage.clear()
  store = createFixtureStore(null)
  api = createFixtureLearningApi({ store, latencyMs: 0 })
})

afterEach(() => {
  cleanup()
  setLearningApi(null)
})

describe('LessonScreen', () => {
  it('opens C-AM-08 at the definition, in Odia at the default notch 2', async () => {
    renderLesson()
    expect(await screen.findByRole('heading', { name: 'Carrier mismatch and debugging', level: 1 })).toBeTruthy()
    const subtitle = screen.getByRole('heading', { level: 1 }).nextElementSibling
    expect(subtitle?.textContent).toBe('Carrier mismatch ଓ Debugging')
    expect(subtitle?.getAttribute('lang')).toBe('or')
    expect(screen.getByText('Draft content')).toBeTruthy()
    expect(screen.getByText('For the lab')).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Language mix' }).getAttribute('aria-valuenow')).toBe('2')

    const steps = within(screen.getByRole('navigation', { name: 'Lesson steps' })).getAllByRole('button')
    expect(steps.map((b) => b.textContent)).toEqual(['1ସଂଜ୍ଞା', '2Carrier mismatch ଓ Debugging', '3Model ରେ ପ୍ରୟୋଗ', '4ମନେ ରଖନ୍ତୁ'])
    expect(steps[0].getAttribute('aria-current')).toBe('step')

    expect(within(placard()).getByText('Step 1 of 4')).toBeTruthy()
    const body = placard().querySelector('p[lang="or"]')!
    expect(body.textContent).toContain('ideal gain-corrected recovery')
    // English terms inside the Odia text are chips
    expect(within(placard()).getByRole('button', { name: 'Phase error' })).toBeTruthy()
  })

  it("doesn't repeat the key idea, which is the same sentence as the definition", async () => {
    window.localStorage.setItem('kiki.dialLevel', '4')
    renderLesson()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(/Key idea/)).toBeNull()
  })

  it('moves with Next and Back, saves the place and focuses the new placard', async () => {
    renderLesson()
    await screen.findByRole('heading', { level: 1 })
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /^Next:/ }))
    expect(within(placard()).getByText('Step 2 of 4')).toBeTruthy()
    expect(document.activeElement?.id).toBe('placard-title')
    await new Promise((r) => setTimeout(r, 0))
    const progress = await api.getProgress('LP-ANALOG-MODULATION')
    expect(progress.concepts.find((c) => c.conceptId === 'C-AM-08')?.position?.placardId).toBe('CARD-AM-08-concept')

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(within(placard()).getByText('Step 1 of 4')).toBeTruthy()
  })

  it('ends with "Check this concept", linking to the concept check', async () => {
    renderLesson()
    await screen.findByRole('heading', { level: 1 })
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Lesson steps' })).getAllByRole('button')[3])
    expect(screen.queryByRole('button', { name: /^Next:/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Check this concept' }).getAttribute('href')).toBe('/assessments/AS-AM-08/new')
  })

  it('resumes at the saved placard', async () => {
    await api.savePosition('C-AM-08', 'CARD-AM-08-application')
    renderLesson()
    expect(await screen.findByText('Step 3 of 4')).toBeTruthy()
    expect(document.activeElement?.id).not.toBe('placard-title')
  })

  it('follows the dial: Odia + meanings at 1, both languages at 3, English at 4, fewer chips at 5', async () => {
    renderLesson()
    await screen.findByRole('heading', { level: 1 })

    setDial('Home')
    const chip = within(placard()).getByRole('button', { name: 'Phase error' })
    expect(chip.nextElementSibling?.textContent).toMatch(/^ \(.*Phase ତଫାତ।\)$/)

    setDial('ArrowRight')
    setDial('ArrowRight')
    expect(placard().querySelector('p[lang="or"]')).toBeTruthy()
    expect(placard().querySelector('p[lang="en"]')?.textContent).toContain('ideal gain-corrected recovery')

    setDial('ArrowRight')
    expect(placard().querySelector('p[lang="or"]')).toBeNull()
    expect(within(placard()).getByRole('heading', { level: 2 }).textContent).toBe('Definition')
    expect(within(placard()).getByRole('button', { name: 'frequency' })).toBeTruthy()
    expect(within(placard()).getByRole('button', { name: 'phase error' })).toBeTruthy()

    setDial('End')
    // Earlier concepts' words are plain text at 5; this concept's own words stay chips
    expect(within(placard()).queryByRole('button', { name: 'frequency' })).toBeNull()
    expect(within(placard()).getByRole('button', { name: 'phase error' })).toBeTruthy()
    expect(window.localStorage.getItem('kiki.dialLevel')).toBe('5')
  })

  it('lists the lesson words, with earlier ones folded away, and opens term details', async () => {
    renderLesson()
    await screen.findByRole('heading', { level: 1 })
    const words = screen.getByRole('region', { name: 'Words in this lesson' })
    const lists = within(words).getAllByRole('list')
    expect(within(lists[0]).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'phase error',
      'frequency mismatch',
      'beating',
    ])
    expect(within(words).getByText('Words from earlier concepts (18)')).toBeTruthy()

    fireEvent.click(within(lists[0]).getByRole('button', { name: 'beating' }))
    const sheet = screen.getByRole('dialog', { name: 'beating' })
    expect(within(sheet).getByText('ବିଟିଙ୍ଗ୍')).toBeTruthy()
  })

  it('says plainly when the concept is not found', async () => {
    renderLesson('/concepts/C-AM-99')
    expect(await screen.findByRole('heading', { name: 'Concept not found' })).toBeTruthy()
  })

  it('offers Retry after a failure, and recovers', async () => {
    let fail = true
    const flaky: LearningApi = {
      ...api,
      getConceptLesson: (id) => (fail ? Promise.reject(new Error('offline')) : api.getConceptLesson(id)),
    }
    renderLesson(undefined, flaky)
    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't load this lesson")
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Carrier mismatch and debugging', level: 1 })).toBeTruthy()
  })
})
