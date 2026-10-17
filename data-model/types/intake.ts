/**
 * Intake model: anything a student puts to us becomes a StudyRequest.
 *
 * A syllabus photo, a chapter name, one typed or spoken question, a photo of a textbook page,
 * the professor's notes, a past paper, an experiment sheet, or a class smart link.
 * Each request is resolved against what already exists (match first, generate second),
 * and anything new goes through the same pipeline into a validated ledger in content.ts.
 *
 *   StudyRequest ──understand──▶ Resolution ──(student confirms)──▶ GenerationJob ──▶ LessonPlan / Concepts
 *        │                                                                  │
 *        └── SourceDocs (pages, OCR text) ──────── SourceRefs on content ◀───┘
 */
import type { Id, LangCode, Scope, Origin } from './content';

export type IntakeKind =
  | 'smart_link'        // a class, chapter, concept or lab link from WhatsApp or a QR code
  | 'syllabus'          // syllabus PDF or photo
  | 'chapter_name'      // "Diodes and rectifiers", typed or picked from a list
  | 'question_typed'
  | 'question_spoken'
  | 'question_photo'    // a homework or textbook question, photographed
  | 'notes'             // the professor's notes or the student's own notes
  | 'textbook_page'
  | 'past_paper'
  | 'experiment_sheet'
  | 'assignment';

export interface SourceDoc {
  id: Id;
  ownerLearnerId: Id;
  sharedWithClassId?: Id;       // a class's syllabus or past paper, reused by classmates
  kind: Exclude<IntakeKind, 'smart_link' | 'chapter_name' | 'question_typed' | 'question_spoken'>;
  title: string;
  mime: string;
  pages: {
    n: number;
    imageAssetId?: string;
    text?: string;              // OCR or extracted text
    ocrConfidence?: number;     // 0 to 1; below 0.6 the student is asked to retake or confirm
    languages?: LangCode[];     // detected; notes are often mixed Odia and English
  }[];
  status: 'uploaded' | 'reading' | 'read' | 'needs_help' | 'failed';
  createdAt: string;
}

/** What the student asked for, in their words, plus anything they attached. */
export interface StudyRequest {
  id: Id;
  learnerId: Id;
  kind: IntakeKind;
  text?: string;                // the question or chapter name, as typed or transcribed
  sourceDocIds: Id[];
  smartLinkId?: Id;
  courseId?: Id;                // when the request was made inside a course
  context?: { screen: string; conceptId?: Id };  // where the student was when they asked
  status: 'received' | 'understanding' | 'needs_confirmation' | 'generating' | 'ready' | 'answered' | 'failed';
  resolution?: Resolution;
  createdAt: string;
}

/**
 * How the request was resolved. Match first: existing concepts are found by canonicalKey and
 * embedding similarity, so "what is ripple?" lands on the existing concept instead of a duplicate.
 */
export interface Resolution {
  action:
    | 'open_existing'          // already in the course: open that concept or plan
    | 'answer_only'            // a quick answer in Ask Kiki is enough; offer "Make this a lesson"
    | 'attach_material'        // notes or a sheet that enrich existing concepts (SourceTags appear)
    | 'extend_plan'            // add concepts to an existing plan
    | 'new_plan';              // generate a new plan at the given scope
  scope?: Scope;
  courseId?: Id;
  lessonPlanId?: Id;
  conceptIds: Id[];            // matched or to be created
  proposal?: OutlineProposal;  // shown to the student to confirm before generating
  studentConfirmed: boolean;
}

/** The outline Kiki proposes before generating content. The student can rename, remove or reorder. */
export interface OutlineProposal {
  title: string;
  scope: Scope;
  broadConcepts: { title: string; concepts: { title: string; matchedConceptId?: Id }[] }[];
  outOfScope: string[];
  estMinutes: number;
  basedOn: { origin: Origin; label: string }[];
}

export type GenerationStage =
  | 'outline'            // pyramid, objectives, terms, syllabus mapping
  | 'validate_outline'   // validate.js shape and ownership rules
  | 'draft_content'      // explanation, walkthrough, example, worked question, checks, practical
  | 'validate_content'   // completeness and check-mix rules; Gemini self-check of answers
  | 'localize'           // support-language text at each dial level
  | 'ready'              // usable, labelled "Kiki-made" until teacher_checked
  | 'failed';

export interface GenerationJob {
  id: Id;
  requestId: Id;
  lessonPlanId: Id;
  stage: GenerationStage;
  /** Concepts are generated in route order so the first lesson is playable before the rest is done. */
  conceptsReady: Id[];
  errors: { rule: string; message: string }[];
  model: string;                // e.g. "gemini-2.5-pro"
  startedAt: string;
  finishedAt?: string;
}

/** A link that drops a student straight into a course, plan, concept or practical. */
export interface SmartLink {
  id: Id;
  slug: string;                 // short path segment in the URL
  channel: 'whatsapp' | 'class_qr' | 'lab_qr' | 'share_card' | 'teacher_dashboard';
  courseId: Id;
  lessonPlanId?: Id;
  conceptId?: Id;
  practicalId?: Id;
  classGroupId?: Id;
  examDate?: string;            // a teacher can stamp the mid-sem date into the link
  createdBy: Id;                // learner or teacher
  createdAt: string;
}
