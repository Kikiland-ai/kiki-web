#!/usr/bin/env node
/*
 * Validates lesson-ledger/v2 files against the MECE pyramid and completeness rules.
 * Subject-agnostic: shape rules come from the plan's scope, check-mix and practical rules from the
 * ledger's embedded SubjectProfile.
 *
 * Usage:
 *   node validate.js ledgers/electronics/diodes-and-rectifiers.json
 *   node validate.js ledgers                      (every .json under the folder, plus cross-ledger checks)
 * Exit code 0 = valid, 1 = errors. Warnings never fail the run.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.length) args.push(path.join(__dirname, 'ledgers'));
const files = args.flatMap((a) => (fs.statSync(a).isDirectory() ? walk(a) : [a]));
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : [])); }

const SHAPE = { chapter: { bc: [2, 5], c: [2, 5] }, topic: { bc: [1, 1], c: [2, 5] }, concept: { bc: [1, 1], c: [1, 1] } };
const QTYPES = ['mcq', 'multi_select', 'numerical', 'term_match', 'fill_blank', 'order_steps', 'label_diagram', 'short_english', 'spoken', 'long_written', 'diagram', 'derivation', 'predict', 'code'];
const DIMS = ['concept', 'words', 'english', 'lab'];
const FUNCS = ['exp', 'log', 'sqrt', 'abs', 'min', 'max', 'sin', 'cos', 'tan', 'pi'];
let totalErrors = 0;
const all = []; // for cross-ledger checks

files.forEach((file) => {
  const L = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = [], warnings = [];
  const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
  const warn = (rule, msg) => warnings.push(`[${rule}] ${msg}`);
  if (L.schema !== 'lesson-ledger/v2') { console.log(`\n${file}\nERROR [S0] Not a lesson-ledger/v2 file (run tools/migrate-v1-to-v2.js).`); totalErrors++; return; }
  all.push({ file, L });

  const prof = L.subjectProfile, lp = L.lessonPlan, course = L.course;
  const bcs = L.broadConcepts, cs = L.concepts, objs = L.objectives, terms = L.terms, prs = L.practicals || [];
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const BC = byId(bcs), C = byId(cs), O = byId(objs), T = byId(terms), PR = byId(prs);

  // ---------- Profile and course ----------
  if (!prof || !prof.id || !prof.practice || !Array.isArray(prof.checkMix)) err('S1', 'Ledger must embed a subject profile with practice and checkMix.');
  if (course.subjectProfileId !== prof.id) err('S1', `Course says profile ${course.subjectProfileId} but the ledger embeds ${prof.id}.`);
  if (!course.languages || !course.languages.source || !course.languages.support || !course.languages.support.length) err('S2', 'Course needs a language policy with a source and at least one support language.');
  if (course.languages && course.languages.dial && course.languages.dial.labels.length !== course.languages.dial.levels) err('S2', 'Dial needs one label per level.');
  if (!course.lessonPlanIds.includes(lp.id)) err('S3', `Course does not list lesson plan ${lp.id}.`);
  if (lp.courseId !== course.id) err('S3', `Lesson plan points to course ${lp.courseId}, not ${course.id}.`);

  // ---------- Pyramid shape by scope ----------
  const shape = SHAPE[lp.scope];
  if (!shape) err('P0', `Unknown scope "${lp.scope}" (chapter, topic or concept).`);
  else {
    const n = lp.broadConceptIds.length;
    if (n < shape.bc[0] || n > shape.bc[1]) err('P1', `A ${lp.scope} plan needs ${shape.bc.join(' to ')} broad concept(s) (has ${n}).`);
    bcs.forEach((b) => { const k = b.conceptIds.length; if (k < shape.c[0] || k > shape.c[1]) err('P1', `${b.id} in a ${lp.scope} plan needs ${shape.c.join(' to ')} concept(s) (has ${k}).`); });
  }
  lp.broadConceptIds.forEach((id) => { if (!BC[id]) err('P2', `Broad concept ${id} listed on the lesson plan does not exist.`); });
  bcs.forEach((b) => {
    if (!lp.broadConceptIds.includes(b.id)) err('P2', `Broad concept ${b.id} is not listed on the lesson plan.`);
    if (b.lessonPlanId !== lp.id) err('P3', `${b.id} points to plan ${b.lessonPlanId}.`);
    b.conceptIds.forEach((cid) => { if (!C[cid]) err('P2', `${b.id} lists missing concept ${cid}.`); else if (C[cid].broadConceptId !== b.id) err('P3', `${cid} says its parent is ${C[cid].broadConceptId}, but ${b.id} lists it.`); });
    if (!b.mece || !b.mece.dimension || !b.mece.rationale) err('P4', `${b.id} must state its split dimension and rationale.`);
  });
  cs.forEach((c) => { const parents = bcs.filter((b) => b.conceptIds.includes(c.id)); if (parents.length !== 1) err('P3', `${c.id} must have exactly one parent broad concept (found ${parents.length}).`); });
  if (!lp.mece || !lp.mece.dimension || !lp.mece.rationale) err('P4', 'The lesson plan must state its split dimension and rationale.');

  // ---------- Mutually exclusive ----------
  objs.forEach((o) => {
    const owners = [lp.objectiveId === o.id ? lp.id : null, ...bcs.filter((b) => b.objectiveId === o.id).map((b) => b.id), ...cs.filter((c) => c.objectiveIds.includes(o.id)).map((c) => c.id)].filter(Boolean);
    if (owners.length !== 1) err('ME1', `Objective ${o.id} must be owned by exactly one node (owned by: ${owners.join(', ') || 'none'}).`);
    else if (owners[0] !== o.ownerId) err('ME1', `Objective ${o.id} says owner ${o.ownerId} but is listed by ${owners[0]}.`);
  });
  terms.forEach((t) => {
    const intro = cs.filter((c) => c.termIds.includes(t.id)).map((c) => c.id);
    if (intro.length !== 1) err('ME2', `Term "${t.term}" must be introduced by exactly one concept (found: ${intro.join(', ') || 'none'}).`);
    else if (intro[0] !== t.ownerConceptId) err('ME2', `Term "${t.term}" says owner ${t.ownerConceptId} but is introduced by ${intro[0]}.`);
  });
  cs.forEach((c) => {
    c.termIds.forEach((tid) => { if (!T[tid]) err('ME2', `${c.id} introduces unknown term ${tid}.`); });
    (c.usesTermIds || []).forEach((tid) => {
      if (c.termIds.includes(tid)) err('ME2', `${c.id} both introduces and "uses" ${tid}; list it once.`);
      else if (!T[tid]) warn('ME2', `${c.id} uses term ${tid} from outside this ledger (checked across ledgers below).`);
    });
  });
  const dup = (arr, key, rule, label) => { const seen = {}; arr.forEach((x) => { const k = String(x[key]).trim().toLowerCase(); if (seen[k]) err(rule, `${label} "${x[key]}" appears twice (${seen[k]}, ${x.id}).`); seen[k] = x.id; }); };
  dup(objs, 'statement', 'ME3', 'Objective');
  dup(cs, 'title', 'ME3', 'Concept title');
  dup(cs, 'canonicalKey', 'ME3', 'Concept canonicalKey');
  dup(terms, 'term', 'ME3', 'Term');
  const allIds = [lp.id, ...bcs.map((x) => x.id), ...cs.map((x) => x.id), ...objs.map((x) => x.id), ...terms.map((x) => x.id), ...prs.map((x) => x.id), ...prs.flatMap((p) => p.faultCards.map((f) => f.id)), ...cs.flatMap((c) => [c.workedQuestion.id, ...c.checks.map((q) => q.id), ...c.misconceptions.map((m) => m.id)])];
  const seenIds = new Set(); allIds.forEach((id) => { if (seenIds.has(id)) err('ME4', `Duplicate id ${id}.`); seenIds.add(id); });

  // ---------- Collectively exhaustive ----------
  objs.forEach((o) => {
    if (o.parentId === null && o.id !== lp.objectiveId) err('CE1', `Only the apex objective may have no parent (${o.id}).`);
    if (o.parentId && !O[o.parentId]) err('CE1', `Objective ${o.id} has unknown parent ${o.parentId}.`);
  });
  if (!O[lp.objectiveId]) err('CE1', 'Apex objective missing.');
  bcs.forEach((b) => {
    const bo = O[b.objectiveId];
    if (!bo) { err('CE1', `${b.id} objective ${b.objectiveId} missing.`); return; }
    if (bo.parentId !== lp.objectiveId) err('CE1', `${b.objectiveId} must be a child of the apex objective.`);
    const childObjs = b.conceptIds.flatMap((cid) => (C[cid] ? C[cid].objectiveIds : []));
    if (!childObjs.length) err('CE1', `${b.id} objective is not covered by any concept objective.`);
    childObjs.forEach((oid) => { if (O[oid] && O[oid].parentId !== b.objectiveId) err('CE1', `Concept objective ${oid} should sit under ${b.objectiveId}.`); });
  });
  if (lp.syllabusLines.length) {
    lp.syllabusLines.forEach((s) => {
      if (!s.conceptIds.length) err('CE2', `Syllabus line "${s.text}" is not covered by any concept.`);
      s.conceptIds.forEach((cid) => { if (!C[cid]) err('CE2', `Syllabus line ${s.id} points to missing concept ${cid}.`); });
    });
    cs.forEach((c) => { if (!lp.syllabusLines.some((s) => s.conceptIds.includes(c.id))) warn('CE2', `${c.id} is not tied to any syllabus line (fine for a bridge concept; check scope).`); });
  } else if (!lp.requestId) err('CE2', 'A plan with no syllabus lines must name the StudyRequest that sets its boundary (requestId).');
  else if (course.kind === 'university') warn('CE2', 'University course with no syllabus lines yet; the student request sets the boundary until the syllabus is uploaded.');
  if (!lp.mece.outOfScope || !lp.mece.outOfScope.length) warn('CE3', 'Name what is out of scope so "exhaustive" has a clear boundary.');

  // ---------- Concept completeness and check mix ----------
  const practicalApplies = prof.practice && prof.practice.applies;
  cs.forEach((c) => {
    const e = c.explanation;
    if (!c.canonicalKey || !/^[a-z0-9-]+$/.test(c.canonicalKey)) err('C0', `${c.id} needs a lowercase slug canonicalKey.`);
    if (!e || !e.text || !e.keyIdea) err('C1', `${c.id} needs an explanation with keyIdea and text.`);
    else {
      const words = e.text.split(/\s+/).length;
      if (words < 50 || words > 160) warn('C1', `${c.id} explanation is ${words} words (aim for 60 to 140).`);
      const vis = e.modalities && e.modalities.textImage && e.modalities.textImage.visual;
      if (!vis || !vis.kind || !vis.description || !vis.alt) err('C1', `${c.id} needs the text + image modality with a visual (kind, description, alt).`);
      else if (prof.visualKinds && !prof.visualKinds.includes(vis.kind)) warn('C1', `${c.id} visual kind "${vis.kind}" is unusual for ${prof.label}.`);
      const steps = (e.modalities && e.modalities.voice && e.modalities.voice.walkthrough) || [];
      if (steps.length < 3 || steps.length > 8) err('C1', `${c.id} voice walkthrough needs 3 to 8 steps (has ${steps.length}).`);
      steps.forEach((s, i) => { if (!e.text.includes(s.target)) err('C1', `${c.id} walkthrough step ${i + 1} target "${s.target}" is not in the explanation text.`); if (!s.say) err('C1', `${c.id} walkthrough step ${i + 1} has no narration (say).`); if (s.dim === 'lab' && !practicalApplies) err('C1', `${c.id} walkthrough marks a lab word, but ${prof.label} has no practical dimension.`); });
      if (e.modalities.video && !['narrated_slides', 'generated_clip'].includes(e.modalities.video.format)) err('C1', `${c.id} video format is unknown.`);
      if (!e.modalities[e.defaultModality === 'textImage' ? 'textImage' : e.defaultModality]) err('C1', `${c.id} default modality ${e.defaultModality} has no content.`);
      const it = e.modalities.interactive;
      if (it) checkInteractive(c, it);
    }
    if (!c.example || !c.example.scenario || !c.example.takeaway) err('C2', `${c.id} needs an example with a scenario and a takeaway.`);
    const w = c.workedQuestion;
    if (!w || !w.prompt || !w.modelAnswer || !w.modelAnswer.length) err('C3', `${c.id} needs a fully answered worked question.`);
    else {
      if (!QTYPES.includes(w.type)) err('C3', `${c.id} worked question type "${w.type}" is not a known question type.`);
      const total = w.rubric.reduce((s, r) => s + r.marks, 0);
      if (total !== w.marks) err('C3', `${c.id} worked question rubric adds to ${total}, not ${w.marks}.`);
      (w.examVocabulary || []).forEach((tid) => { if (!T[tid]) err('C3', `${c.id} worked question uses unknown term ${tid}.`); else if (!c.termIds.includes(tid) && !(c.usesTermIds || []).includes(tid)) warn('C3', `${c.id} worked question needs "${T[tid].term}" but the concept neither introduces nor uses it.`); });
    }
    const checks = c.checks || [];
    if (checks.length < 3) err('C4', `${c.id} needs at least 3 check questions (has ${checks.length}).`);
    prof.checkMix.forEach((rule) => {
      if (rule.when === 'has_practical' && !(practicalApplies && c.practicalId)) return;
      if (!checks.some((q) => q.dimension === rule.dimension && rule.anyOfTypes.includes(q.type))) err('C4', `${c.id} needs a ${rule.dimension} check (${rule.anyOfTypes.join(', ')}).`);
    });
    checks.forEach((q) => {
      if (!QTYPES.includes(q.type)) err('C5', `${q.id} type "${q.type}" is not a known question type.`);
      if (!DIMS.includes(q.dimension)) err('C5', `${q.id} dimension "${q.dimension}" is not one of ${DIMS.join(', ')}.`);
      if (q.dimension === 'lab' && !practicalApplies) err('C4', `${q.id} is a lab check, but ${prof.label} has no practical dimension.`);
      q.objectiveIds.forEach((oid) => { if (!c.objectiveIds.includes(oid)) err('C5', `${q.id} tests ${oid}, which ${c.id} does not own.`); });
      if (['mcq', 'term_match'].includes(q.type) && (!q.options || !q.options.includes(q.answer))) err('C5', `${q.id} answer must be one of its options.`);
      if (q.type === 'numerical') {
        if (!/\d/.test(q.answer)) err('C5', `${q.id} numerical answer needs a value.`);
        if (prof.unitsMatter && !q.unit) warn('C5', `${q.id} numerical answer has no unit; ${prof.label} marks units.`);
      }
      if (['long_written', 'derivation'].includes(q.type) && q.marks && (!q.rubric || q.rubric.reduce((s, r) => s + r.marks, 0) !== q.marks)) warn('C5', `${q.id} is marked out of ${q.marks} but has no rubric that adds up.`);
    });
    if (!c.misconceptions || !c.misconceptions.length) warn('C6', `${c.id} has no misconceptions listed (they drive diagnosis and fault cards).`);
    if (!c.sources || !c.sources.length) err('C7', `${c.id} must say where its content came from (sources).`);
    if (!c.review || !c.review.status) err('C7', `${c.id} needs a review status.`);
    else if (c.review.status === 'draft') warn('C7', `${c.id} is a draft and will not be shown to students.`);
    if (c.practicalId) { if (!practicalApplies) err('T2', `${c.id} links a practical, but ${prof.label} has no practical dimension.`); else if (!PR[c.practicalId]) err('T2', `${c.id} links unknown practical ${c.practicalId}.`); }
    if (!c.examSignal || !['past_papers', 'estimate', 'none'].includes(c.examSignal.basis)) err('X1', `${c.id} needs an examSignal with a basis.`);
    (course.languages.support || []).forEach((lang) => { if (!c.localization || !c.localization.perLanguage || !c.localization.perLanguage[lang]) warn('L1', `${c.id} has no localization entry for ${lang}.`); });
  });

  function checkInteractive(c, it) {
    const kinds = prof.interactiveKinds || [];
    if (!kinds.includes(it.kind)) warn('C1', `${c.id} interactive "${it.kind}" is not listed for ${prof.label}.`);
    if (!it.prompt) err('C1', `${c.id} interactive needs a prompt.`);
    if (it.kind === 'parameter_sweep') {
      const names = it.inputs.map((i) => i.name);
      it.inputs.forEach((i) => { if (!(i.min <= i.default && i.default <= i.max)) err('C1', `${c.id} input ${i.name} default is outside its range.`); });
      const scope = Object.fromEntries(it.inputs.map((i) => [i.name, i.default]));
      it.outputs.forEach((o) => {
        const v = evalFormula(o.formula, names, scope);
        if (typeof v === 'string') err('C1', `${c.id} output ${o.name}: ${v}`);
        else if (!Number.isFinite(v)) err('C1', `${c.id} output ${o.name} is not a finite number at the default inputs.`);
      });
    }
    if (it.kind === 'simulation' && !PR[it.practicalId]) err('C1', `${c.id} interactive simulation points to unknown practical ${it.practicalId}.`);
    if (it.kind === 'sort_steps' && (!it.correctOrder || it.correctOrder.length < 3)) err('C1', `${c.id} sort_steps needs at least 3 steps.`);
    if (it.kind === 'step_through' && (!it.steps || it.steps.length < 2)) err('C1', `${c.id} step_through needs at least 2 steps.`);
  }

  // ---------- Practicals ----------
  prs.forEach((p) => {
    if (!practicalApplies) err('T2', `${prof.label} has no practical dimension, but practical ${p.id} exists.`);
    if (prof.practice.kinds.length && !prof.practice.kinds.includes(p.kind)) warn('T2', `Practical ${p.id} kind "${p.kind}" is unusual for ${prof.label}.`);
    p.conceptIds.forEach((cid) => { if (!C[cid] || C[cid].practicalId !== p.id) err('T2', `Practical ${p.id} lists ${cid}, which does not point back to it.`); });
    if (!p.steps || !p.steps.length) err('T3', `Practical ${p.id} needs steps.`);
    if (!p.expected) err('T3', `Practical ${p.id} needs an expected result.`);
    if (!p.faultCards || !p.faultCards.length) warn('T3', `Practical ${p.id} has no fault cards for the debug challenge.`);
    const misIds = new Set(cs.flatMap((c) => c.misconceptions.map((m) => m.id)));
    (p.faultCards || []).forEach((f) => { if (f.misconceptionId && !misIds.has(f.misconceptionId)) err('T3', `Fault card ${f.id} points to unknown misconception ${f.misconceptionId}.`); });
    if (!p.vivaPrompts || !p.vivaPrompts.length) warn('T3', `Practical ${p.id} has no viva prompts.`);
  });

  // ---------- Prerequisites and term order ----------
  cs.forEach((c) => c.prerequisiteIds.forEach((p) => { if (p === c.id) err('D1', `${c.id} cannot require itself.`); else if (!C[p]) warn('D1', `${c.id} requires ${p} from another plan (checked across ledgers below).`); }));
  const state = {};
  function visit(id, stack) {
    if (state[id] === 'done') return;
    if (state[id] === 'active') { err('D2', `Prerequisite cycle: ${[...stack, id].join(' -> ')}`); return; }
    state[id] = 'active';
    (C[id] ? C[id].prerequisiteIds : []).forEach((p) => visit(p, [...stack, id]));
    state[id] = 'done';
  }
  cs.forEach((c) => visit(c.id, []));
  const ancestors = (id, acc = new Set()) => { (C[id] ? C[id].prerequisiteIds : []).forEach((p) => { if (!acc.has(p)) { acc.add(p); ancestors(p, acc); } }); return acc; };
  cs.forEach((c) => {
    const before = ancestors(c.id);
    (c.usesTermIds || []).forEach((tid) => { const t = T[tid]; if (t && !before.has(t.ownerConceptId)) warn('D3', `${c.id} uses "${t.term}", introduced in ${t.ownerConceptId}, which is not one of its prerequisites. Add the prerequisite or introduce the term earlier.`); });
  });

  // ---------- Exam signal from past papers ----------
  const pq = L.pastQuestions || [];
  if (pq.length) {
    const papers = new Set(pq.map((q) => q.paperId)).size;
    cs.forEach((c) => {
      const asked = new Set(pq.filter((q) => q.conceptIds.includes(c.id)).map((q) => q.paperId)).size;
      if (c.examSignal.basis === 'past_papers' && (c.examSignal.askedIn !== asked || c.examSignal.outOf !== papers)) err('X2', `${c.id} examSignal says ${c.examSignal.askedIn}/${c.examSignal.outOf} but past papers give ${asked}/${papers}.`);
    });
  } else {
    const est = cs.filter((c) => c.examSignal && c.examSignal.basis === 'estimate').length;
    if (est) warn('X2', `${est} concept(s) use estimated exam weights; add past papers to compute them.`);
  }

  // ---------- Totals ----------
  const minutes = cs.reduce((s, c) => s + c.estMinutes, 0);
  if (minutes !== lp.estMinutes) warn('T1', `Lesson plan says ${lp.estMinutes} min but concepts add to ${minutes} min.`);
  if (!lp.review || !lp.review.status) err('C7', 'Lesson plan needs a review status.');

  // ---------- Report ----------
  const checkCount = cs.reduce((s, c) => s + c.checks.length, 0);
  console.log(`\n${path.relative(process.cwd(), file)}`);
  console.log(`${lp.title} · ${prof.label} · scope ${lp.scope} · ${course.kind} course`);
  console.log(`Pyramid: 1 plan > ${bcs.length} broad concept(s) > ${cs.length} concept(s); ${objs.length} objectives, ${terms.length} terms, ${checkCount} checks, ${prs.length} practical(s), ${minutes} min.`);
  warnings.forEach((w) => console.log('warning ' + w));
  if (errors.length) { errors.forEach((e) => console.log('ERROR ' + e)); console.log(`${errors.length} error(s).`); totalErrors += errors.length; }
  else console.log('Valid: mutually exclusive, collectively exhaustive, complete.');
});

// ---------- Cross-ledger checks (same course) ----------
if (all.length > 1) {
  const byCourse = {};
  all.forEach((x) => { (byCourse[x.L.course.id] = byCourse[x.L.course.id] || []).push(x); });
  const xerr = [];
  Object.entries(byCourse).forEach(([cid, list]) => {
    const terms = list.flatMap((x) => x.L.terms.map((t) => ({ ...t, file: x.file })));
    const owner = {};
    terms.forEach((t) => { const k = t.term.toLowerCase(); if (owner[k] && owner[k] !== t.ownerConceptId) xerr.push(`[XL1] Course ${cid}: term "${t.term}" is introduced twice (${owner[k]} and ${t.ownerConceptId}).`); owner[k] = t.ownerConceptId; });
    const termIds = new Set(terms.map((t) => t.id));
    const conceptIds = new Set(list.flatMap((x) => x.L.concepts.map((c) => c.id)));
    const keys = {};
    list.forEach((x) => x.L.concepts.forEach((c) => {
      (c.usesTermIds || []).forEach((tid) => { if (!termIds.has(tid)) xerr.push(`[XL2] ${c.id} uses term ${tid}, which no ledger in course ${cid} introduces.`); });
      c.prerequisiteIds.forEach((p) => { if (!conceptIds.has(p)) xerr.push(`[XL3] ${c.id} requires ${p}, which no ledger in course ${cid} defines.`); });
      if (keys[c.canonicalKey]) xerr.push(`[XL4] Course ${cid}: canonicalKey "${c.canonicalKey}" used by ${keys[c.canonicalKey]} and ${c.id}; merge them.`);
      keys[c.canonicalKey] = c.id;
    }));
  });
  console.log(`\nCross-ledger: ${all.length} ledgers, ${Object.keys(byCourse).length} course(s).`);
  xerr.forEach((e) => console.log('ERROR ' + e));
  if (!xerr.length) console.log('No term owned twice, no dangling prerequisites or term uses, no duplicate concepts.');
  totalErrors += xerr.length;
}

process.exit(totalErrors ? 1 : 0);

function evalFormula(f, names, scope) {
  const tokens = f.match(/[A-Za-z_][A-Za-z0-9_]*|\d*\.?\d+(?:e-?\d+)?|[+\-*/^(),]/g) || [];
  if (tokens.join('') !== f.replace(/\s+/g, '')) return `formula "${f}" has characters that are not allowed`;
  for (const t of tokens) if (/^[A-Za-z_]/.test(t) && !names.includes(t) && !FUNCS.includes(t) && !/^\d/.test(t) && t !== 'e') return `formula uses unknown name "${t}"`;
  const js = tokens.map((t) => (t === '^' ? '**' : FUNCS.includes(t) ? (t === 'pi' ? 'Math.PI' : `Math.${t}`) : t)).join(' ').replace(/(\d) e (-?) (\d)/g, '$1e$2$3');
  try { return Function(...names, `return (${js});`)(...names.map((n) => scope[n])); } catch (e) { return `formula "${f}" does not evaluate (${e.message})`; }
}
