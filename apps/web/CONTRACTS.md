# Shared web contract — aligned v0.4, Python sign-off pending

Arpan's supplied `api.ts` and `services.ts` have been reconciled into [`src/contracts/api.ts`](src/contracts/api.ts) and [`src/contracts/services.ts`](src/contracts/services.ts). The original Downloads files remain unchanged. This local alignment preserves the working first UI slice; it does not claim a working Python backend or agreement from the other contributors. Contract revision: `kiki-web/v0.4-aligned`.

## Agreed local integration shape

- `profile.ts` remains the single runtime-validated profile: `id` is the Firebase UID; schema `profile/v1`; onboarding steps 0–3; nullable completion/ratings; both self-confidence ratings and sentence preference retained. Odia and English remain supported. `api.ts` aliases this type rather than introducing Arpan's incompatible `uid`/named-step/selfRatings shape. No existing browser-profile migration is required.
- Auth keeps `subscribe(listener, onError)`, `signIn({ remember, redirect })`, `signOut()` and `getIdToken(forceRefresh?)`. `registerSignOutCleanup()` is now implemented for both fixture and Firebase adapters. Registered handlers stop/hide local resources synchronously, then may release remote resources asynchronously. Failed or slow release does not block sign-out indefinitely; the default deadline is three seconds. Auth loss/account switching also invokes cleanup. This verifies the registry, not actual media/capture/lease integration.
- Profile operations are named **LearnerApi**; **LearningApi** now means chapter/lesson/progress operations, matching Arpan's separation. The factory is `createLearnerApi`; the running app retains `services.api` for profile operations. `services/types.ts` re-exports the canonical interfaces so existing screens do not need a second auth/profile store.
- Profile endpoints retain `{ profile: … }` wrappers and `/learners/me/profile`; enrollment remains `/learners/me/enrollments`. `getProfile` is implemented in both adapters. Intake and assessment adapters are now registered in the composition root. Learning/lab envelopes and interfaces exist; those adapters remain pending.
- Public `ConnectionUpdate` cannot set `workspaceConfirmed` or active connection state. Browser evidence submissions are student reports or owner-authorized screenshot references, never assertions of trusted integration provenance or verdicts. Student-report output cannot have a verified verdict. Python must enforce these rules at runtime; TypeScript alone does not secure an endpoint. Trusted extension evidence and cue transport remain provisional pending the real adapter review.
- The server pointer flag is eligibility, not permanent permission. Arpan's guide must also check this browser's controlling device ID, lease expiry and current live workspace/capture status before drawing, and stop immediately when they change. Preserve same-owner session links and reconnection on control transfer.
- Terms require English spelling, Odia pronunciation and meaning; Odia help stays available on tap at level 5. Two-text-version rendering remains an initial approximation, not five newly generated teaching versions.

Next: the Python owner reviews/mirrors the contracts in Pydantic and publishes OpenAPI; generate TypeScript from that agreed schema. Add runtime validation for new feature payloads when implementing their real adapters. Arpan can build against these names now; no shortened demo scope or calendar commitments were adopted from the attached draft.

## Assessment slice

`Services.assessments` is now required, with `start/get/saveDraft/submit/getResult/overview`. Public run metadata adds ownership, content version, revision, status, saved choices/position and origin; results add owner/version. Runtime validation, HTTP transport, labelled fixture scoring and the React attempt/result screens are implemented. See [ASSESSMENT_CONTRACT.md](ASSESSMENT_CONTRACT.md) for proposed Python envelopes, idempotency, thresholds and prerequisite rules. Profile/auth shapes remain unchanged. These additive local changes still require Python/team agreement.

## Profile implementation — 15 October 2026

The user-authorized Python profile implementation now lives in [apps/api](../api/README.md), with the actual [OpenAPI schema](../api/openapi.json). Bootstrap, profile GET/PATCH and enrollment preserve the wire contract below. Server-side Firebase verification/ownership and Firestore transactions are implemented. Intake/assessment/lab endpoints and their Python agreement remain separate pending work.

## Profile boundary v1

**Second slice:** `Services` now also provides `intake: IntakeApi`. Its schemas, multipart upload/status/confirmation/retry/original transport and browser-only adapter are implemented separately. See [INTAKE_CONTRACT.md](INTAKE_CONTRACT.md). The core profile/auth contracts remain unchanged; the new projection is `intake-view/v1`. No live extraction/generation endpoint is claimed.

The profile endpoints below are now implemented in the local Python module; team review/generated-client adoption still remains. [`src/contracts/profile.ts`](src/contracts/profile.ts) contains runtime-validated request-independent profile shapes. Replace/align these with generated Python OpenAPI types after agreement; do not maintain two incompatible schemas.

All requests carry `Authorization: Bearer <Firebase ID token>`. Python verifies it, derives UID, enforces ownership and returns `{ "profile": ... }`. The client additionally rejects a profile whose `id` differs from the current Firebase identity. Tokens remain with the Firebase SDK and request headers; the app does not copy them into browser storage/logs.

| Method/path | Request | Response / semantics |
|---|---|---|
| `POST /learners/me/bootstrap` | No body | Load/create one profile for verified UID; repeat-safe; do not reset an existing profile |
| `PATCH /learners/me/profile` | `supportLanguage`, `dialLevel`, `onboarding` | Allowlisted preference/onboarding update; return the saved profile; no client mastery/evidence fields |
| `POST /learners/me/enrollments` | `{ courseId: "CRS-AC-ECE", semester: 1..8 }` | Validate course access; transactionally add unique membership; persist semester server-side; repeat-safe |

Initial profile example (use actual verified UID/display name on server):

```json
{
  "schema": "profile/v1",
  "id": "verified-firebase-uid",
  "displayName": "Bikash",
  "supportLanguage": "or",
  "dialLevel": 2,
  "courseIds": [],
  "onboarding": {
    "step": 0,
    "completedAt": null,
    "fluencySelfRatings": null,
    "easyLanguageAnswer": null
  }
}
```

Steps: 0 language, 1 comfort, 2 support, 3 confirmation. A completed step saves the **next** step. Completion sets a valid ISO `completedAt` with step 3 and both ratings/preference present. `fluencySelfRatings` is `{ support: { language: "or", outOf10: 9 }, englishOutOf10: 3, assessedBy: "self" }`; `easyLanguageAnswer` is `regional|mixed|english`. These fields are preferences/confidence, never proficiency. Students confirm/change the starting dial; ratings do not automatically move it. Only Odia/English are supported in this slice.

The Python backend should validate rating bounds, language consistency, completion requirements and enrollment uniqueness. Server time should normalize saved timestamps. Profile fields are additive to the existing learner model (`id`, `supportLanguage`, `dialLevel`, `courseIds`, onboarding ratings); this projection intentionally excludes unrelated learner goals, evidence and legacy `signedIn`. Unknown response fields are ignored by the schema, not used as authority.

Errors: 401 expired/missing identity; 403 ownership/access denial; 422 invalid input; 5xx unavailable service. No failure is treated as a successful save. Requests have a 15-second deadline and bootstrap cancellation on account change/unmount. Configure exact CORS for the local frontend origin. Final authentication/ownership enforcement is server-side; UI guards alone are not security tests.

Local fixture adapter has the same API interface, uses synthetic `fixture-bikash` only, and never issues a Firebase token. Its semester form validates input but does not simulate a persisted academic record; the real enrollment API must store that field. Browser-only preview data does not demonstrate a phone-to-laptop handoff.

## Private originals — 15 October

Python upload/list/request/source/content now implemented in `apps/api`; generated [OpenAPI](../api/openapi.json) is current. Intake adds `stored` (saved originals, processing deferred) and optional cursor paging; React uses 25-record pages. Real connected Library list reads Firestore; cloud originals await [reviewed setup](../api/STORAGE_SETUP.md). Confirm/retry remain explicit 409 until a processor exists. No fixture readiness is accepted as live processing.

## Combined learning boundary — 15 October

Map/lessons now use Services.learning through the current app session/composition. Required ownerLearnerId added to ChapterProgress; Chapter/Lesson/Progress/Position runtime schemas live in contracts/learning.ts. [Learning contract](LEARNING_CONTRACT.md) covers the preview projection and proposed Python GET content/progress + PUT positions. Python OpenAPI does not claim these pending endpoints. Current assessment API remains the sole preview score/history authority; no imported six-pass fixture store.
