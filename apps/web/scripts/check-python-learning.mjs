/** Validate actual Python test receipts against the React runtime contracts. */
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const receipts = JSON.parse(await readFile(new URL('../../api/test-artifacts/learning-contract.json', import.meta.url), 'utf8'));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const learning = await server.ssrLoadModule('/src/contracts/learning.ts');
  const assessment = await server.ssrLoadModule('/src/contracts/assessment.ts');
  for (const [key, schema] of Object.entries({
    chapter: learning.ChapterEnvelope, lesson: learning.LessonEnvelope, visualLesson: learning.LessonEnvelope,
    progress: learning.ProgressEnvelope, position: learning.PositionEnvelope,
    run: assessment.RunEnvelope, result: assessment.ResultEnvelope, overview: assessment.OverviewEnvelope,
  })) {
    schema.parse(receipts[key]);
    console.log(`Python → React ${key}: passed`);
  }
  const lab = await server.ssrLoadModule('/src/contracts/lab-preparation.ts');
  const labReceipts=JSON.parse(await readFile(new URL('../../api/test-artifacts/lab-preparation-contract.json',import.meta.url),'utf8'));
  lab.PracticalEnvelope.parse(labReceipts.practical);
  lab.PreparationEnvelope.parse(labReceipts.preparation);
  console.log('Python → React practical/preparation: passed');
  const intake = await server.ssrLoadModule('/src/contracts/intake.ts');
  const text = await server.ssrLoadModule('/src/contracts/document-text.ts');
  const textReceipts = JSON.parse(await readFile(new URL('../../api/test-artifacts/document-text-contract.json', import.meta.url), 'utf8'));
  intake.RequestEnvelope.parse(textReceipts.receipt);
  intake.RequestsEnvelope.parse(textReceipts.list);
  text.SourceTextSchema.parse(textReceipts.text);
  console.log('Python → React document text create/list/read: passed');
  assessment.checkResultForRun(receipts.run.run, receipts.result.result);
  const media = await server.ssrLoadModule('/src/contracts/concept-media.ts');
  const mediaReceipts=JSON.parse(await readFile(new URL('../../api/test-artifacts/media-contract.json',import.meta.url),'utf8'));
  const { lesson } = learning.LessonEnvelope.parse(mediaReceipts.mediaLesson);
  const { manifest } = media.MediaManifestEnvelope.parse(mediaReceipts.mediaManifest);
  media.checkManifestForLesson(manifest, lesson);
  if (manifest.unsupportedArtifacts.length || manifest.artifacts.length !== lesson.mediaExperience.artifacts.length) throw new Error('React does not render every published scene.');
  console.log('Python → React media lesson/manifest: passed');
} finally { await server.close(); }
