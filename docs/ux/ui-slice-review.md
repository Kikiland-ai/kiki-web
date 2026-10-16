## Latest lab walkthrough — 16 October 2026

1. Open **http://127.0.0.1:5174/labs**, or click top-right **Lab mode**.
2. Read the DSB-SC aim and seven-concept readiness. **Start lab preparation** or **Resume lab preparation** is available before passing all checks.
3. Read the twelve checkpoints. Moving between them changes your reading place; it does not mark an experiment step verified.
4. Enter your prediction, optional saved-model reference and observation drafts. Click **Save preparation** before leaving/copying. Unsaved edits prompt Save and leave, Keep editing or explicit Leave without saving.
5. **Copy session link** and reopen with the same Google account; Home also has Resume lab preparation. For actual phone/laptop use the app needs a shared reachable hosted address: 127.0.0.1 is this computer only.
6. Open **MATLAB / Simulink Online** separately when needed, and save your actual .slx/project there. Monitoring/assessment and Hey Clickky will connect later through Aditya's backend; the current screen says Manual preparation / Monitoring not connected.

Live review saved checkpoint 2 at revision 1 with blank prediction/model/observations; readiness is 1/7 from the student's existing concept result. No experiment evidence or practical scores were invented. [Current status](../../apps/web/active.md) · [preparation/Aditya contract](../../apps/web/LAB_PREPARATION_CONTRACT.md).

---

## Latest connected walkthrough — 15 October 2026

Use **http://127.0.0.1:5174/learn** with Google for the real account flow. 5173 remains a labelled browser-only preview.

1. Sign in with Google. New accounts complete onboarding and add Analog Communication with their own semester. Akshita chose **Semester 3**, now saved.
2. Open **Learn** for the Firestore chapter map. Choose a concept and read its four bilingual placards. The dial changes language support; **Place saved** confirms the current step reached Firestore.
3. Reload/re-sign in to resume the saved lesson. Concept 1 currently resumes at **Step 2**. Reading gives Learning, never a pass.
4. At the last placard choose **Check this concept**, or use Home → Practise concepts. Concept 1 already has one **unanswered** live check from integration verification. Resume it; select your own five answers and submit. The backend calculates the result; return to **Chapter map** for the same progress.
5. Below 3/5, revisit and retry; ≥3/5 passes. All ten passed concepts unlock the ten-question chapter check at ≥8/10. Only the seven specified concepts gate lab theory readiness. Actual lab execution/pointer integration is still pending.

Live checked: chapter/content, user-selected Semester 3 enrollment, lesson Step 2 save/reload and fresh independent Google sign-in in a second tab, real assessment list/assignment and unanswered quiz cursor save/reload. No answers or scores were invented for the student. First actual student submission/result/map acceptance, physical phones and real lab/media remain open.

Firestore now holds the authored content; original JSON stays in Git. Source/Odia review remains draft; question retries currently repeat the same bank. Storage for uploaded originals is a separate unresolved colleague dependency; no billing upgrade. See [current status](../../apps/web/active.md) and [backend data/import notes](../../apps/api/LEARNING_STORAGE.md).

---

# Review the current Kiki UI slice

## Latest review — combined learning flow (15 October)

1. Open **http://127.0.0.1:5173/learn**. If prompted, choose **Open sample student** and finish onboarding if new.
2. On **Analog Modulation**, click **Continue** or the first concept. Existing preview checks are preserved; new sample learners have no preloaded passes.
3. Read the four placards. Move **Language mix**; tap a technical word for Odia pronunciation/meaning. The choice uses the same saved Profile preference.
4. Move to another placard; wait for **Place saved in this browser**. Reload to verify it resumes. Save failures show an explicit Retry action.
5. On the last placard, click **Check this concept**, answer five questions and submit. **3/5 passes**, below that shows Revisit.
6. Click **Chapter map** on the result. The same concept now shows the result and latest accuracy. Reading alone does not pass a check.
7. The chapter test unlocks after all ten concept checks; the DSB-SC readiness panel requires only its seven concepts. Later lessons allow preview and explain missing prerequisites.

This combined flow is **labelled browser-only preview**. Real Google/profile remains on 5174; its teaching/position/evaluation endpoints are the next Python step, so Learn there reports unavailable without sample fallback. Arpan's original standalone reference remains on 5180. [Current status](../../apps/web/active.md) and [learning contract](../../apps/web/LEARNING_CONTRACT.md) identify the exact boundaries.

Checks: 93 unit/contract, full 50 browser + final 13 learning rechecks, lint/typecheck/build; eight widths 320–1440px. Physical phones and reviewed live content/media are still pending.

The earlier sections below preserve previous slice walkthroughs.

Updated: 15 October 2026 · React + TypeScript preview and connected account flow

Open **http://127.0.0.1:5173**. The preview server responded successfully when this guide was written. Look for **Sample preview · Saved in this browser only**. This is the current review mode; it does not create a Google account or save to the Python backend.

The current slice adds **concept/chapter bilingual MCQs, saved drafts, results, revisit/retry and attempt history**, alongside material intake and Library. Lessons and actual lab execution are still pending. The sample controls demonstrate processing states explicitly; no OCR or lesson generation runs in this mode.

## Walk through as a new student

If the app opens your existing Home/Profile immediately, that is expected: your previous sample session is saved. To review first-time onboarding without changing that session, open the same link in a fresh private/incognito window. Use a fresh private session with all previous private windows closed if necessary. Alternatively, keep your existing sample and start at the Home/Profile checks below.

| Step | What to click or enter | What you should see / what this proves |
|---|---|---|
| 1. Welcome | Open the link | White welcome page, Kiki logo, regional-script logo animation and Get started. Animation can be skipped; reduced motion keeps it static. |
| 2. Account entry | **Get started** | Shared/personal-device choice and Sign in with Google. Google is deliberately disabled in sample mode. |
| 3. Sample student | **Open sample student** | A new synthetic student enters onboarding. An existing sample resumes its saved preferences instead. |
| 4. Language | Choose **Odia / ଓଡ଼ିଆ** → **Save and continue** | Odia is the learning preference; navigation remains English. English technical terms will be retained in future lessons. |
| 5. Confidence | Set **Odia confidence = 9**, **English confidence = 3** → **Save and continue** | Both out-of-ten self-ratings are saved as confidence, not proficiency. Refresh now: you should return to Support rather than restart. |
| 6. Support | Keep **Odia explanation + English terms** and support **2/5** → **Save and continue** | You can move the five-level slider yourself, or choose a different sentence preference. |
| 7. Confirm | Check Odia, 9/10, 3/10 and support 2/5 → **Go to my home** | Home greets sample student Bikash. Completing onboarding does not award learning scores. |
| 8. First subject | **Add your subject** → choose a semester, for example Semester 5 → **Add subject** | ECE and Analog Communication are preselected for this pilot. The subject appears with Open subject. The sample validates the semester but does not persist an academic semester record. |
| 9. Subject overview | **Open subject** | Analog Communication with the Analog Modulation chapter, Add syllabus, Add today’s material and Open Library. |
| 10. Chapter boundary | **View chapter** | An explicit “being prepared” page. The chapter map and actual lessons are not integrated yet. |
| 11. Profile | **Profile** in the left rail or phone bottom navigation | Editable language, both confidence ratings, support dial and Sign out. Change English confidence to 4 → Save preferences → refresh: it should remain 4 in this browser. |
| 12. Material and pending areas | **Home → Add today’s material**, or **Library** | Material intake and Library now work. Learn and top-right Lab mode still show explicit unfinished pages; no live pointer is claimed. |
| 13. Sign out / return | **Profile → Sign out**, then **Open sample student** | Protected profile content disappears at sign-out. Reopening the sample returns to the saved preferences without repeating completed onboarding. The preview retains synthetic profile data in this browser only. |

Before any completed checks, all four Home evidence areas say **Not assessed**. After a quiz, green reports concept checks passed; red technical words, yellow academic English and blue practical remain unassessed. Setting confidence, saving material or adding a subject must not fill them.

## Walk through the new material slice

After adding Analog Communication, follow these steps. You can use a PDF or a clear JPEG/PNG image. The original files are stored in this browser only in the preview.

| Step | Click / enter | Expected result |
|---|---|---|
| 1 | **Home → Add today’s material**, or **Open subject → Add syllabus** | Material form opens with subject context. Choose Syllabus, Class notes or Lab manual. |
| 2 | Confirm topic, optional date and “This was taught today” note → **Choose files** | Accepted formats: PDF/JPEG/PNG, up to 10 MB each, five per request. Selected filenames appear; remove a file if needed. Invalid files show a message without discarding valid selections. |
| 3 | **Save material in preview** | Actual originals are saved in the browser. The request opens at Reading material. No analysis has happened. |
| 4 | Open **Library**, then refresh / return using **Open request** | The received request and originals remain available. Home also shows recent requests. Refresh Library checks for a request after an uncertain/stopped upload. |
| 5 | **Preview sample outline** | A clearly labelled Analog Modulation example appears. It is not extracted from your uploaded file. Class-note outlines are marked provisional. |
| 6 | Edit chapter/concept titles or deselect a concept → **Confirm outline and prepare lessons** | Review choices save; at least one concept must remain selected. The next screen shows a confirmed outline. No real lessons are generated in sample mode. |
| 7 | **Preview ready state** | A labelled sample-ready state appears. Open chapter still leads to the chapter boundary page until Arpan's map/lessons are integrated. |
| 8 | **Open original**, or open a filename in **Library** | View the stored image/PDF and download the exact original. PDF inline rendering depends on the browser; use Download original if it cannot display it. |
| 9 | To check recovery, add another request → **Preview reading failure → Retry reading** | Same request and original files survive the retry; then you can preview the outline again. |

The latest sample outline is a curated ten-concept example. It cannot establish that your notes match that chapter. In connected mode, the actual Python service must produce the source-backed outline and real processing status.

## Walk through the assessment slice

Use **Home → Practise concepts** or **Open subject → Concept checks**. These checks use the labelled, curated Analog Modulation sample bank; they are not generated from your uploaded notes.

| Step | Click / enter | Expected result |
|---|---|---|
| 1 | **Start concept check** beside a concept you have studied | Five questions; passing threshold 3/5 (60%); one question at a time. |
| 2 | Choose an answer → wait for **Draft saved** → **Next question** | Answer and question position save. Numbered buttons let you revisit earlier questions; unanswered items remain clear. |
| 3 | Switch **Odia + English / Odia / English** | Wording changes; selected option and question meaning stay the same. English technical terms remain in the Odia text. |
| 4 | Refresh, or **Pause and leave → Save and leave** | Refresh reopens saved answers. In-app departure asks for confirmation; Concept checks → Resume check returns to the saved question. A choice marked not saved needs Retry saving before leaving. |
| 5 | Answer all five → **Submit check** | Correct count, percentage, concept breakdown and bilingual explanation for each answer. Incomplete checks cannot submit. 2/5 revisits; 3/5 passes. |
| 6 | On a failed result, review feedback/your notes → tick **I reviewed the feedback or revisited my notes.** → **Retry this check** | A new attempt starts; earlier results remain in Previous attempts. Preview retries repeat the bank. The checkbox is a self-report and awards no score. |
| 7 | **All concept checks**, or **Home** | Latest completed concept results appear. Green shows checks passed; other evidence areas remain Not assessed. The lesson/map buttons still lead to Arpan's integration boundaries. |
| 8 | Pass all ten concept checks → **Start chapter test** | Ten bilingual questions, one per concept. 7/10 revisits; 8/10 (80%) passes. |
| 9 | For a quick chapter-screen review only: **Load chapter-ready preview** | Adds ten clearly labelled passed prerequisite setup records. It preserves earlier attempts/material, but changes the sample's prerequisite state. Use a private window if you want to leave your usual sample untouched. Then Start chapter test. |

The required-lab-theory card counts only seven prerequisite concepts. The chapter test does **not** gate this lab. Passing theory cannot activate a real pointer or establish simulator performance. Lesson/map and actual Lab mode integration remain pending.

## Review laptop and phone layouts

First use the normal laptop window: navigation is on the left and Home uses the available width. Then narrow the window, or use the browser's responsive-device view at **390px**. The same pages should stack into a single column, with Home/Learn/Library/Profile along the bottom; Lab mode remains at the top right. Resize during a form: selections should stay in place. Scroll to reach actions when the viewport is short.

Automated browser checks already covered 320/360/390/430/768/1024/1280/1440px, rotation, keyboard navigation and reduced motion. This is not a claim that physical Android/iPhone, the on-screen keyboard or real browser text zoom has passed.

## Where we are now

| Area | Current state |
|---|---|
| React/TypeScript app, responsive shell and baseline components | Working locally; Arpan's expanded shared kit is still to integrate |
| Welcome, account UI, onboarding, Home and editable Profile | Working with browser-only sample data |
| ECE subject enrollment and overview | Working in sample mode; now links to syllabus/class-material intake |
| Shared API/service contracts | Aligned locally as `kiki-web/v0.4-aligned`; Python/team sign-off remains pending |
| Cleanup registration for future audio/capture/lab resources | Implemented and unit-tested; real resources are not connected |
| Real Google sign-in and Firebase/Python profile saving | Live Google → Python → Firestore profile → onboarding/Home, including reload and sign-out/return, verified |
| Material intake, Library and original viewer | Working preview UI; actual files persist locally; labelled sample processing and outline review; real upload API adapter exists but server integration is pending |
| Chapter map, concept lessons, terms, narration | Arpan's feature work; currently boundary pages |
| Concept/chapter MCQs and results | Working preview: drafts/resume, thresholds, feedback, retries/history and separate readiness; Python grading pending |
| Real Simulink pointer, checkpoint tracking and phone-to-laptop handoff | Pending Arpan/backend/extension integration |
| Written-answer repair and hardware support | Pending later slices |

We have completed **locally testable foundation, account/preferences, subject setup, material/Library and assessment UI slices**—partial implementation-plan Phases 1–3 and the quiz portion of Phase 5. The real account, upload/storage/extraction/generation gates and later learning/lab phases are not complete.

## Status and next step

The current status is [apps/web/active.md](../../apps/web/active.md), updated after each completed step. [Build history](../plans/ui-build-progress.md) preserves previous outcomes.

Latest verification: **44 unit/contract tests and 36 Chromium browser tests, plus lint, typecheck and production build passed**. Quiz/results fit all eight agreed widths, including blocked web fonts; native SVG icons preserve navigation size. Threshold tests compare with the repository learning-case evaluator. Fixture keys and scoring remain absent from the production build. These checks do not validate live Firebase/Python, physical phones or actual Simulink guidance.

Next: integrate Arpan's chapter/map/lesson modules with the new assessment routes and agree/validate the Python [profile](../../apps/web/CONTRACTS.md), [material](../../apps/web/INTAKE_CONTRACT.md) and [assessment](../../apps/web/ASSESSMENT_CONTRACT.md) endpoints. These remain necessary for a source-backed learning loop.

## Review the connected account flow

The sample stays on **5173**. The real account flow is on **http://127.0.0.1:5174**, with Python running on **8000**. Google sign-in now verifies through Python and creates/retrieves your UID-owned Firestore profile.

New learner profile: Google sign-in → four onboarding steps; refresh resumes the last saved step → confirm → Home. Returning completed profile: Google sign-in → Home (or the protected destination you opened). The real browser check completed onboarding with default Odia / confidence 5+5 / support 2/5 preferences, so Akshita's account now returns to Home. Use **Profile** to enter your preferred values. No proficiency was awarded.

The app is left signed in at **http://127.0.0.1:5174/home**. `/connection` is a development-only view of Firebase identity and Python profile readiness. [Python startup](../../apps/api/README.md) explains how to restart port 8000; [Firebase setup](../../apps/web/FIREBASE_SETUP.md) explains the approved keyless credentials and private database.

Connected Library/upload, grading and Arpan's lessons/labs are still separate pending APIs/modules. Browser sample files/scores on 5173 do not migrate into this real account. Current verification and continuation are in [active.md](../../apps/web/active.md): 17 Python API checks plus live onboarding/reload/return acceptance; earlier frontend test results remain separately recorded.

## If the preview server has stopped

Run from a terminal; keep it open while reviewing:

```sh
cd apps/web
npm exec --yes --package=node@24 -- npm run dev
```

If dependencies are missing in a new checkout, run `npm exec --yes --package=node@24 -- npm ci` first. See [the app README](../../apps/web/README.md) for connected-mode setup. The sample preview does not require Firebase credentials.

## Connected Library update — 15 October

On http://127.0.0.1:5174 sign in, then **Library → Refresh Library**. This list now comes from the authenticated Python/Firestore service (currently empty for the live student). **Add material** routes through subject enrollment as before. Real cloud uploads are awaiting the Firebase Blaze/private-bucket decision; attempts show an explicit error and keep selected files. After setup, the intended verified route is **Add subject → Add material → Upload material → Saved in Library → Open original / Download original → reload Library**. Reading/lesson preparation remains unavailable. Libraries with more than 25 requests offer **Load more material**. Browser-only sample originals remain on 5173.

## Arpan map/lesson review preview — 15 October

Open http://127.0.0.1:5180/chapters/LP-ANALOG-MODULATION. This is a separate labelled fixture preview of Arpan’s latest feature branch. Click Continue: Carrier mismatch and debugging; use the dial, term sheets and four placards, then Learn to return. Six passes are seeded demo data; quizzes/auth/Home/Library there are placeholders. The working connected app remains on 5174. [Review and integration status](arpan-map-review.md).

## Latest: DSB-SC teaching diagrams — 16 October

1. Open http://127.0.0.1:5174/concepts/C-AM-04 and sign in with Google if asked. With Analog Communication enrolled, choose **Step 2: DSB-SC Generation ଓ Sidebands**. You can preview the lesson even while prerequisite checks are pending.
2. Scroll below the explanation to **From two signals to two sidebands**. Read the Message × Carrier → Product diagram and the signed waveform.
3. Check the spectrum: lower **1900 Hz**, upper **2100 Hz**; the hollow **2000 Hz** marker is only a carrier-frequency reference.
4. Move **Message frequency** to 200 Hz: the actual stems move to **1800/2200 Hz**. Reset to the lesson example. This exploration is local and does not change lab settings or pass a check.
5. Open **sideband** below the control. Read its English spelling, Odia-script pronunciation and Odia meaning. The same sheet shows both highlighted sidebands. Close it to compare the highlights on the main diagram; Clear diagram highlight removes them.
6. Step 3 (Application) also shows the diagrams. Step 4 still leads to the existing concept check. Reload restores the saved placard; diagram exploration resets to the lesson baseline.

Reviewed in the real Google/Firestore lesson and a 390 px browser viewport. These are calculated teaching figures, not Simulink recordings or screen-share assessment. Narration and content/Odia review remain pending; Aditya's monitoring integration remains separate. Latest tests/status: [active.md](../../apps/web/active.md).
