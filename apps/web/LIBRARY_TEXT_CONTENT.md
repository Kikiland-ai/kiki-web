# Library text content — 17 October 2026

Current implementation: `feature/library-text-content` in `kiki-web-library-text`, based on published redesign `2cfc241`. User authorized source commit/push to `origin/feature/library-text-content` on 17 October; author/committer and authenticated GitHub account are `akshitanitr`. No deployment. The PR #2 build and published redesign branch are separate.

Current user decision: text extraction and Firestore text persistence are internal details. The public UI shows ordinary uploads and a static Library history, with no text review, reader, paste entry, extraction labels or storage explanation. Cards have no links, buttons, tab stops or click behavior. Existing text content remains real and private in Firestore; no original binary/media storage is added.

The user personally verified a lecture PDF upload and confirmed its text in Firestore. Earlier reader/review acceptance is retained below as backend evidence; it no longer describes the public flow.

## Try it locally

- **http://127.0.0.1:5194** is the connected build, using Google sign-in and the existing Firebase project through the new API at **http://127.0.0.1:8001/docs**. Existing ignored configuration was read into process environments; no credentials/configuration files were copied to this checkout. These local processes need restarting after they stop, using the existing documented connected setup and these explicit ports/CORS origins.
- **http://127.0.0.1:5193** is the labelled browser-only sample. Its actual entered/extracted text persists in IndexedDB, without a cloud write. It uses the same parsers and review UI.
- Original apps on 5174/8000 and redesign preview on 5192 are preserved.

Sign in → add Analog Communication if needed → Library → Add material → choose PDF/PPTX → **Upload material** → Library. Selected filenames appear while preparing; document content and extraction warnings stay internal. Success returns directly to **Previous uploads**, with one static card per document showing filename, type, topic and upload date. Older `/library/:sourceId` links and text-only `/intake/:requestId` receipts redirect to Library. Existing original-file backend adapters remain available, but Library exposes no file reader/download action.

Current UI checks: 138 frontend tests, ESLint and TypeScript/production build pass. Connected actual lecture card verified with zero interactive descendants; eight-width Library/form checks pass from 320–1440px. The updated automated browser material suite was not executed. Proof: ignored `test-results/document-text/library-upload-cards.png`. No new cloud writes were needed for this presentation change.

## Extraction and limits

Browser-side, lazy PDF.js (legacy build with compatible polyfills) reads selectable PDF text; fflate plus XML parsing reads PPTX slide paragraphs in presentation order, including styled runs and explicit line breaks. Media and unrelated ZIP entries are excluded. Page/slide numbers are preserved in the saved text; blank units and extraction warnings are retained in internal metadata. No binary file is sent by the new JSON transport or retained in its sample store.

Limits: five documents/save; each original up to 10 MiB and 500 pages/slides; extracted UTF-8 text up to 1 MiB/document. PPTX XML has bounded selected entry counts and expanded bytes. Older `.ppt` must be converted to `.pptx`/PDF. Scans, screenshots and image-only slides need OCR outside this feature; scanned documents must first be converted to a PDF/PPTX with selectable text. Images, diagrams, audio/video, layout, equation formatting and slide notes are not retained. Reading order, formulas and character fidelity require extraction QA; this is source text, not generated lesson content.

## API and persistence handoff

`POST /study-requests/text` accepts JSON `{courseId, kind, topic, note, classDate, documents}` with a Firebase bearer token and `Idempotency-Key`. Each document has `{title, mime, size, method, unitLabel, unitCount, units:[{number,text}], warnings}`. The browser does not submit a learner ID. Python verifies identity, subject enrollment, source type/method consistency, ordered/non-empty units, dates and byte limits. An actual received-body limit also applies.

The API derives owner and stable request/source IDs and atomically writes:

- `learners/{uid}/studyRequests/{requestId}`: existing Library receipt shape, `status=text_saved`, `jobId=null`, no generated outline/lesson/progress.
- `learners/{uid}/sourceDocs/{sourceId}`: title/type/details, `originalAvailable=false`, `sha256=null`, extraction summary and warnings.
- `.../sourceDocs/{sourceId}/textChunks/{0000...}`: ordered UTF-8 text chunks, each at most 32 KiB, with integrity SHA-256.
- `learners/{uid}/textSaveOperations/{requestId}`: payload fingerprint for retry consistency. Same key/same payload replays the receipt; changed payload returns 409.

`GET /source-docs/{sourceId}/text?cursor=0` returns `{source,chunks:[{index,text}],nextCursor}`. Five chunks/page; source ownership, chunk order and integrity are checked. Existing list/get endpoints include text records. Calling the original-content endpoint for a text-only source returns 409. API UID checks remain authoritative; no direct browser Firestore access or new IAM/rules/index configuration. Text still consumes Firestore storage/read/write quotas.

Original-file endpoints and binary validation remain available for previously stored originals; the current Library UI exposes no original viewer. Text saving creates no intake job, sample outline, grade, lesson or lab evidence. A future generation build should consume internal saved text through a deliberate owner-checked path and add its own processing lifecycle; it must not reinterpret `text_saved` as `reading` or `ready`.

Code entry points: `features/intake/text/`, `contracts/document-text.ts`, `services/intake-http.ts`, `features/library/Library.tsx`, and `apps/api/src/kiki_api/document_text.py`. The existing service composition root is retained. Install the updated npm lock for PDF.js/fflate. No Python dependency or catalog/content migration is required.

## Verification and remaining acceptance

- 138 frontend unit/contract tests; 94 Python tests (14 for text persistence), lint, TypeScript/production build and Python→React actual response contracts pass.
- Actual PDF.js extraction and PPTX XML/ZIP extraction are exercised with valid generated documents, including presentation ordering, Unicode, line breaks, blank input, limits and unsafe relationships. HTTP checks verify authenticated JSON contains reviewed text and no original file body. API doubles cover ownership, no-bucket operation, retries/conflicts, pagination, corruption and limits; they do not prove cloud persistence.
- Browser sample walkthrough verified entered English/Odia review → save → read → refresh → Library; 198 KiB Unicode pagination appends through its final marker. Reader overflow checks pass at 320/360/390/430/768/1024/1280/1440px. Proof screenshots are ignored under `test-results/document-text/`.
- Connected local UI loads Google sign-in, API exposes both new routes, and unauthenticated saving returns 401. **Live text persistence now verified:** Google sign-in with the existing account, one explicitly labelled synthetic English/Odia pasted-text document, authenticated save, text read, full refresh and Library return all succeed. The entry is “Kiki Library verification — 17 Oct 2026”; its note explicitly identifies acceptance-test content. No original file/media, grade, lesson or lab evidence was created. Proof: ignored `test-results/document-text/live-saved-text.png`. The user subsequently uploaded a real lecture PDF successfully and confirmed its text in Firestore. Real PPTX browser acceptance remains pending.
- Browser file-picker automation remains blocked by the Chrome extension's file-URL permission; parser unit checks and pasted-text browser review do not substitute for that acceptance. No browser permission was changed. Updated `tests/materials.spec.ts` covers the new flow, but the full automated browser suite was not run in this session. Physical devices and real-world PDF/PPTX fidelity remain pending.

Final publication verification: 138 frontend and 94 API tests, ESLint, Ruff/format, TypeScript/build, Python→React contracts, exact OpenAPI comparison and production fixture/answer-key exclusion checks pass. Connected Library refresh displays real uploads as static cards with no content actions or technical copy. No new live test upload was created during this verification. The user accepted a real PDF upload and independently confirmed its text in Firestore. Real PPTX browser smoke testing and the full automated browser suite remain unclaimed. Source publication is authorized on the separate feature branch. No deployment, billing, Storage or IAM changes.
