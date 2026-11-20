import { QuestionView, Report, TurnView, type TutorApi } from '../contracts/tutor';
import { ServiceError } from '../services/types';

/**
 * Development/browser-test tutor. It replays views recorded from the real Python engine
 * (scripts/tutor_export_fixture.py); it contains no tutoring logic of its own.
 */
type Recording = {
  questionId: string; lang: 'en' | 'or'; start: string;
  items: Record<string, unknown>; views: Record<string, Record<string, unknown> & { boardIds: string[]; node: string }>;
  edges: Record<string, Record<string, string>>; reports: Record<string, unknown>;
  pathReports: unknown[]; reportByPath: Record<string, number>;
  question: unknown; text: Record<string, { node: string; label: string }>;
};
type Session = { qid: string; lang: 'en' | 'or'; key: string; turns: Record<string, string>; path: string[] };

const STORE = 'kiki.fixture.tutor.sessions';
let recordings: Promise<Recording[]> | null = null;
// Imported as raw text so the type checker never infers types for the 1.6 MB recording.
const load = () => (recordings ??= import('./tutor-recording.json?raw').then(m => (JSON.parse(m.default) as { recordings: Recording[] }).recordings));

function sessions(): Record<string, Session> {
  try { return JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Record<string, Session>; } catch { return {}; }
}
function save(all: Record<string, Session>) { sessionStorage.setItem(STORE, JSON.stringify(all)); }

async function recording(qid: string, lang: 'en' | 'or') {
  const all = await load();
  const r = all.find(x => x.questionId === qid && x.lang === lang) ?? all.find(x => x.questionId === qid && x.lang === 'en');
  if (!r) throw new ServiceError('That tutor question does not exist.', 404);
  return r;
}

function view(r: Recording, key: string, sessionId: string, restate = false) {
  const v = r.views[key];
  const board = v.boardIds.map(id => r.items[id]);
  const out = { ...v, sessionId, board } as Record<string, unknown>;
  delete out.boardIds;
  if (restate) {
    const brief = out.brief as { segments: { kind: string; say: string }[]; say: string };
    const probe = [...brief.segments].reverse().find(s => s.kind === 'probe' || s.kind === 'hint');
    const say = probe?.say ?? brief.say;
    out.brief = { ...brief, say, segments: [{ kind: 'restate', node: v.node, say, reveals: [], focus: [] }] };
    out.revealed = []; out.route = { label: 'off_topic', confidence: 1, quote: null, termsUsed: [] };
  }
  return TurnView.parse(out);
}

export function createFixtureTutor(requireUid: () => string): TutorApi {
  const sid = (uid: string, qid: string, lang: string, key: string) => `fx-${uid}-${qid}-${lang}-${key}`.replace(/[^\w-]/g, '').slice(0, 120);
  return {
    async health() { return { enabled: true }; },
    async question(qid) { requireUid(); return QuestionView.parse((await recording(qid, 'en')).question); },
    async start(qid, lang, key) {
      const uid = requireUid(), r = await recording(qid, lang), id = sid(uid, qid, lang, key);
      const all = sessions();
      all[id] ??= { qid, lang, key: r.start, turns: {}, path: [] };
      save(all);
      return view(r, all[id].key, id);
    },
    async get(id) {
      requireUid();
      const s = sessions()[id];
      if (!s) throw new ServiceError('That tutor session could not be found.', 404);
      return view(await recording(s.qid, s.lang), s.key, id);
    },
    async turn(id, input, idem) {
      requireUid();
      const all = sessions(), s = all[id];
      if (!s) throw new ServiceError('That tutor session could not be found.', 404);
      const r = await recording(s.qid, s.lang);
      if (s.turns[idem]) return view(r, s.turns[idem], id);
      const current = r.views[s.key];
      if ((current as { done?: boolean }).done) throw new ServiceError('This session is complete.', 409);
      let label: string;
      if ('chip' in input) {
        if (!(r.edges[s.key] ?? {})[input.chip]) throw new ServiceError('That reply option is not available at this step.', 422);
        label = input.chip;
      } else {
        const hit = r.text[input.text.trim()];
        label = hit && hit.node === current.node ? hit.label : 'unclear';
      }
      if (label === 'off_topic') return view(r, s.key, id, true);
      const out = r.edges[s.key] ?? {};
      const taken = out[label] ? label : 'unclear';        // unrecorded labels behave as unclear
      const next = out[taken];
      if (!next) throw new ServiceError('The sample tutor has no recording for that reply.', 409);
      s.key = next; s.turns[idem] = next; s.path = [...(s.path ?? []), taken];
      save(all);
      return view(r, next, id);
    },
    async report(id) {
      requireUid();
      const s = sessions()[id];
      if (!s) throw new ServiceError('That tutor session could not be found.', 404);
      const r = await recording(s.qid, s.lang);
      // exact report for the label path when recorded; otherwise the report recorded for this end state
      const exact = r.reportByPath?.[(s.path ?? []).join('>')];
      const rep = (exact !== undefined ? r.pathReports[exact] : r.reports[s.key]) as Record<string, unknown> | undefined;
      if (!rep) throw new ServiceError('The report appears when the session is complete.', 409);
      return Report.parse({ ...rep, board: (rep.sheet as string[]).map(i => r.items[i]) });
    },
    async speech() { return { leaks: [] }; },
    async voiceToken() { throw new ServiceError('Voice is not available in the sample preview. Continue by typing.', 503); },
  };
}
