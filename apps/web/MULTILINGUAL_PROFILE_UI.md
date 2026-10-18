# Language- and field-flexible learner UI

18 October 2026. Branch `redesign/aditya-multilingual-profile`, based on latest `main` (`b984c64`), after merged PRs #7 and #8. The user requested generic positioning for students from Indian regional-language backgrounds, with Aditya (Odia, ECE) as one demo learner. The user authorized preparing a separate PR for this revision; merged lab work is retained and pending PR #9 is separate.

## Product behavior

The welcome page, sign-in and Sketchbook identity describe learning in the student's language and field. The public welcome page stays generic, with no Aditya example paragraph; the explicitly labelled sample sign-in introduces Aditya. Language and field are chosen in the first setup step, confirmed before Home and editable in Profile. Listed languages/fields and free-text choices are accepted; the support copy and confidence labels follow the selected language.

The browser-only demo starts with Aditya's Odia/ECE preferences. After confirmation, its ECE subject, chapter, checks and lab preparation continue through the existing authored package. The generic account contract is separate from teaching availability: prepared content currently covers Analog Communication/ECE in Odia and English. Other combinations save preferences and show a matching availability state; course-specific deep links, checks, uploads and lab routes also respect that state. Library history and account settings remain accessible. English preference renders the English teaching view.

Changing a language or field preserves enrollment, progress, grades, saved notes and uploads. The old demo UID/local-storage keys are retained so existing sample records survive the visible rename to Aditya. Google identities/display names are unchanged. Existing enrolled profiles without field metadata infer the ECE context from their retained enrollment, with no Firestore migration.

## Contracts and source

`supportLanguage` and its self-rating language are bounded nonempty preference strings (existing `or`/`en` remain valid). The optional `studyField` string is added to Pydantic/Zod/OpenAPI. Labels map familiar selections to stable values; custom choices are retained. Profile updates omitted by older clients do not clear field metadata. New Google profiles start with English as the unconfirmed default; the explicit Aditya fixture starts with Odia/ECE.

The current bilingual teaching/media contracts remain `or`/`en`; this work does not generate translations or add curricula. `learning-preferences.ts` owns labels, support descriptions and current-demo availability. `StudyRoute`/Home/Subjects follow saved context, and the assessment provider avoids loading the demo overview for other combinations. Existing Google auth, API ownership and enrollment requirements remain.

## Verification and review

- 185 frontend tests /38 files, 119 API tests, ESLint, TypeScript/production build, Ruff/format, OpenAPI regeneration and Python→React receipts pass.
- Fourteen existing journey browser tests pass, including eight widths, keyboard, rotation, reload, failed save/retry, deep links and sign-out.
- Two new browser cases pass: Hindi/CSE setup/persistence and safe content availability; switching to Odia/ECE, adding the subject, retaining enrollment after another field change, English teaching view, four Profile widths; legacy demo rename with stable UID/enrollment.
- The local sample was opened in a separate automated browser to inspect welcome, setup and mobile Profile. Ignored screenshots: `test-artifacts/aditya-context/`. No live Google sign-in, learner record write, model/provider request, cloud publication or deployment was performed.

Review **http://127.0.0.1:5195/** (Aditya sample), or **http://127.0.0.1:5194/** (normal Google identity). The connected API on8001 was restarted with the additive preference contract and existing approved configuration in process only. Use Profile to review preferences on an existing session; a private browser window shows the full welcome/setup journey without clearing saved data. Publication is authorized for this branch as a new PR into `main`; no merge or deployment is requested. The connected preview credential-path correction is local process configuration; README documents correct path resolution. Profile-load error copy is included in source. A read-only Firestore probe passes; genuine Google/profile retry remains a separate live acceptance check.
