// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CamCanvas } from './CamCanvas';
import { PhaseRecoveryScene } from './PhaseRecoveryScene';
import { MediaManifestSchema, checkManifestForLesson, findRendition, verifyNarrationTextBindings } from '../../contracts/concept-media';
import { LessonSchema } from '../../contracts/learning';
import { sampleMediaExperienceForConcept } from '../../fixtures/media';
import content from '../../fixtures/learning-content.json';
import Models from '../../media/cam-models.mjs';
import saved from '../../../../../data-model/media/cam-contract/scenes.json';
import cases from '../../../../../data-model/media/cam-contract/conformance.json';
import { CamSceneSchema } from '../../contracts/cam-canvas';
const records = import.meta.glob<{ manifest: unknown }>('../../fixtures/all-cam/*.json', { eager: true, import: 'default' });
afterEach(cleanup);
for (const record of Object.values(records)) {
  const manifest = MediaManifestSchema.parse(record.manifest);
  describe(manifest.conceptId, () => {
    it('pairs ordered coverage and selects the correct available language for all four cards', async () => {
      const lesson = LessonSchema.parse({ ...content.lessons[manifest.conceptId as keyof typeof content.lessons], mediaExperience: sampleMediaExperienceForConcept(manifest.conceptId) });
      expect(checkManifestForLesson(manifest, lesson)).toBe(manifest);
      await verifyNarrationTextBindings(manifest, lesson);
      for (const p of lesson.placards) {
        expect(findRendition(manifest, p.id, 'or')).toBeTruthy();
        expect(Boolean(findRendition(manifest, p.id, 'en'))).toBe(manifest.conceptId === 'C-AM-08');
      }
      const broken = structuredClone(lesson); broken.mediaExperience!.narration.reverse();
      if (manifest.narration.length > 1) expect(() => checkManifestForLesson(manifest, broken)).toThrow();
    });
    it('renders only its own trusted artifact with declared bounds and reset', () => {
      const a = manifest.artifacts[0];
      render(a.renderer === 'cam-concept-canvas/v1' ? <CamCanvas artifact={a} /> : <PhaseRecoveryScene scene={a} />);
      const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
      const controls = a.renderer === 'cam-concept-canvas/v1' ? a.scene.controls : a.controls;
      for (const [i, c] of controls.entries()) {
        expect(Number(sliders[i].min)).toBe(c.min); expect(Number(sliders[i].max)).toBe(c.max);
        fireEvent.change(sliders[i], { target: { value: c.max } }); expect(Number(sliders[i].value)).toBe(c.max);
      }
      fireEvent.click(screen.getByRole('button', { name: a.renderer === 'cam-concept-canvas/v1' ? 'Reset model' : 'Reset to lesson example' }));
      controls.forEach((c, i) => expect(Number(sliders[i].value)).toBe(c.default));
      expect(document.querySelector('script')).toBeNull();
    });
  });
}
it('runs all 38 exact conformance cases through the vendored model across all ten kinds', () => {
  let count = 0;
  for (const [id, tests] of Object.entries(cases)) {
    const scene = CamSceneSchema.parse(saved[id as keyof typeof saved].scene);
    for (const t of tests) {
      const result = Models.render(scene, t.inputs, t.cursor);
      expect(result.readouts).toEqual(t.readouts); expect(result.extraSvg !== null).toBe(t.hasExtraSvg);
      result.series.forEach((series, j) => [0,.125,.25,.5,.75,1].forEach((x,k) => expect(Math.abs(series.fn(x) - t.samples[j].values[k])).toBeLessThan(1e-12)));
      count++;
    }
    expect(() => Models.render(scene, { [scene.controls[0].name]: NaN })).toThrow();
  }
  expect(count).toBe(38);
});
it('rejects altered model/source hashes, controls, behavior cases and concept coverage', () => {
  const first = Object.values(records)[0];
  for (const key of ['model', 'source', 'cases', 'bounds']) {
    const raw = structuredClone(first.manifest) as { artifacts: { modelBindings: { sha256: string }[]; bindings: { sha256: string }[]; scene: { controls: { max: number }[] }; behaviorTests: { readouts: string[][] }[] }[] };
    const a = raw.artifacts[0];
    if (key === 'model') a.modelBindings[0].sha256 = '0'.repeat(64);
    if (key === 'source') a.bindings[0].sha256 = '0'.repeat(64);
    if (key === 'cases') a.behaviorTests[0].readouts[0][1] = 'invented';
    if (key === 'bounds') a.scene.controls[0].max = 999999;
    expect(MediaManifestSchema.safeParse(raw).success).toBe(false);
  }
});
it('keeps the fallback DSB renderer when no common canvas occupies its lesson slot', async () => {
  const { scenesFor } = await import('./scenes');
  const visual = (await import('../../fixtures/dsb-sc-visual.json')).default;
  const lesson = LessonSchema.parse({ ...content.lessons['C-AM-04'], visual });
  const slots = scenesFor(lesson, null, lesson.placards[1], { terms: lesson.terms, selectedTermId: null, onTermOpen: () => {} });
  render(<>{slots.map(s => <div key={s.key}>{s.node}</div>)}</>);
  expect(screen.getByRole('region', { name: 'DSB-SC teaching diagrams' })).toBeTruthy();
});
