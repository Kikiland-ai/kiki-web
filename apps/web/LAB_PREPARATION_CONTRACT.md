# Lab preparation boundary and Aditya handoff

16 October 2026 · Preparation implementation · Screen-share observation/assessment deferred

## Ownership and current scope

Akshita confirmed that **Aditya is researching the backend for monitoring and assessing screen-shared browser software**. Integrate that later. This step implements experiment selection, theory readiness, written checkpoint preparation, saved notes and same-account continuation only. Arpan's lab home/tracker/checkpoint composition from kiki-web/ui/arpan-a11y (2256077) informed the flow; global singleton APIs, simulated extension connections and completion ticks were not imported.

The public `LabPreparationApi` is deliberately separate from the older provisional execution `LabApi` in api.ts/services.ts. Preparation is not a live controller, lease, screen-sharing session or verified experiment result. This avoids claiming Aditya's final protocol in advance.

## Student flow

Top-right **Lab mode** → selected DSB-SC experiment → seven concept checks → **Start lab preparation** (or Resume) → read the 12 authored checkpoints → prediction/model reference/observation drafts → **Save preparation** → **Copy session link**. Home also offers Resume lab preparation.

A phone uses one column. Laptop uses checkpoint/main work area alongside readiness/session notes. Read/checkpoint navigation edits a reading position, not completion. Unsaved changes are visible, blocked on navigation/refresh and disabled for copying until saved; Save and leave persists them. No actual software window is embedded or observed.

Opening MATLAB/Simulink Online is a separate external link and separate MathWorks sign-in. It does not prove software opened, save the .slx file, enable capture or activate a pointer. The model reference is student-entered text and is never treated as a verified workspace.

## Public HTTP / models

Implemented Pydantic/OpenAPI: ../api/src/kiki_api/lab_preparation.py and ../api/openapi.json. React runtime validation: src/contracts/lab-preparation.ts. All calls require Firebase Google bearer verification and existing course membership; owner UID never comes from a request body.

| Method/path | Body | Response |
|---|---|---|
| GET /practicals/PR-AM-DSB | — | {practical}: selected public catalog/version, aim/software, prediction prompt, two observation prompts, 12 instructions/why/expected/source refs |
| POST /lab-preparations | {practicalId} | {preparation}; transactionally reuse/create one preparation per UID/practical/version |
| GET /lab-preparations/active?practicalId=PR-AM-DSB | — | {preparation: object or null} for active catalog version |
| GET /lab-preparations/{id} | — | {preparation}; explicit old links retain pinned content version |
| PATCH /lab-preparations/{id} | {expectedRevision,currentCheckpointId,prediction,projectRef,observationNotes} | {preparation}; owner-scoped transaction, repeat-safe identical fields, 409 stale different update |

Draft bounds: prediction/each of two observation notes ≤3000 characters; model reference ≤500; only observation keys 0 and 1 and actual checkpoint IDs accepted. Unknown ownership, monitoring, evidence, completion, assessment or readiness fields are rejected. Missing/foreign session returns 404; sign-in 401, enrollment 403, conflict 409, invalid body 422, unavailable dependency 503.

Preparation includes id/owner/practical/contentVersion/revision/timestamps, pinned practical, saved fields, server-derived readiness, sessionPath, and exactly:

```json
{"monitoring":{"status":"pending_integration","pointerActive":false,"assessmentStatus":"not_assessed"}}
```

The public app cannot change these monitoring values. Passing the seven required concept checks does not activate them. No preparation operation updates scores, mastery, verified checkpoints or lab completion.

## Persistence and continuation

Firestore `learners/{uid}/labPreparations/{prep-uuid}` stores the record, pinned catalog version and draft. `learners/{uid}/labPreparationHeads/{version}` points to the current preparation for this pilot's sole practical. Start/read/update preserve profiles, material and assessment records. No new catalog migration, indexes, IAM, client rules, Storage or billing.

The copied URL is `/labs/{id}` on the current app origin. It contains no tokens, credentials or grants; opening it requires the same Google UID and profile/course access. No expiry is needed for this owner-protected bookmark. This is not the older proposed expiring controller-transfer handshake. Until Aditya integration, no execution device/lease is claimed. Simultaneous note edits use optimistic revisions, with 409 conflict and explicit saved/local comparison before replacing local text. No live synchronization/polling is claimed; reload/resume fetches saved state.

## Later integration — discuss with Aditya

Keep the same preparation/session identity or explicitly map it to the future monitored run. Before implementing execution, agree on:

- Trusted observation identity: owner, session, catalog version, workspace/tab, consent/capture state and freshness.
- Checkpoint evidence schema and verdicts, including unobserved/uncertain/rejected states. Student notes remain reports, not verified outcomes.
- How completion/assessment evidence updates blue practical progress without reusing theory scores.
- Device/control/lease transitions, disconnect, wrong workspace, revoked capture and stale-frame handling.
- Pointer cue transport/coordinates, confidence/freshness and target placement. Activate only after experiment selected, seven checks passed, software/workspace/observation confirmed and control held. Student performs all external actions.

These are integration questions, not an imposed implementation or a promise of an extension. Aditya's actual supported approach determines the runtime bridge. No screen captures or external model actions are attempted in this slice.

## Verification

78 API tests (13 new lab cases), 96 frontend unit/contract checks, practical/preparation Python→React runtime receipt validation and eight targeted lab browser checks pass. Full 60 browser regressions and final eight lab rechecks pass. Live real-session creation, checkpoint 2/revision 1 reload and Home resume are verified; prediction/model/observation text remains blank. Physical devices and a shared hosted URL remain pending. Detailed evidence is recorded in active.md. Test doubles do not prove cloud contention or physical phones. The existing direct-client deny rules remain; fixture practical/localStorage adapter is development-only and excluded from connected production.
