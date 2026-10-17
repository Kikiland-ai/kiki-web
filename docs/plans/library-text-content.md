# Library document content and upload history

Status: Accepted; final source publication checkpoint · 17 October 2026

User decisions: retain PDF/PowerPoint content as text in Firestore without original-media storage. Keep extraction internal. Public Library is static upload history; no text review, reader, paste entry, download or clickable document cards. No billing upgrade, bucket or IAM change.

Branch `feature/library-text-content` in `kiki-web-library-text`, based on published redesign `2cfc241`. PR #2’s separate in-progress build and the original app stay separate.

Implemented:
1. Lazy browser PDF.js/PPTX extraction, cancellable preparation, selected filenames and upload errors. Upload material sends JSON document text to the existing authenticated service composition root, then returns directly to Library.
2. UID-owned authenticated API with enrollment, bounded UTF-8 input, consistent idempotency and atomic Firestore request/source/chunk records. No Storage dependency, original binaries, processing job, generated lesson or mastery claim.
3. One static card/document with filename, material type, topic, upload date and Uploaded status. Existing records remain intact; old text-reader/receipt links return to Library.
4. Parser, transport, persistence/ownership/retry, UI and cross-language contract checks; current handoff and student walkthrough.

Limits: five documents/save, each up to 10 MiB and 500 pages/slides; up to 1 MiB extracted UTF-8 text/document, stored in chunks capped at 32 KiB. Images/media, layout and equation formatting are excluded. Scans need OCR before uploading; older PPT needs conversion. Firestore usage quotas still apply.

Final checks: 138 frontend tests, 94 Python tests, ESLint, Ruff/format, TypeScript/production build, Python→React response contracts, exact OpenAPI comparison, production fixture/answer-key exclusion and whitespace checks pass. Connected Library/static cards, refresh and old-reader redirect verified; eight-width Library/form overflow checks pass. User verified a real lecture PDF and confirmed its text in Firestore. No new live test upload was needed for final verification. Full automated browser suite and real PPTX browser smoke test were not rerun/claimed.

Publication: user authorized commit and push on 17 October to `origin/feature/library-text-content`, as `akshitanitr`. No merge or deployment. Exact next product step: real PPTX smoke test, then integration with the separate in-progress build when ready. [Implementation and handoff](../../apps/web/LIBRARY_TEXT_CONTENT.md).
