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
  assessment.checkResultForRun(receipts.run.run, receipts.result.result);
} finally { await server.close(); }
