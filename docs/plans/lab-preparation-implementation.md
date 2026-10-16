# Lab preparation and saved continuation

Status: Implemented; user/device review and Aditya integration remain · 16 October 2026 · BB8 reference-mode engineering implementation

## Objective and success

Top-right Lab mode opens DSB-SC preparation from the existing Firestore catalog. Students see seven-concept readiness, read 12 checkpoints, save prediction/project reference/observation drafts and copy an owner-protected session URL. Reload and same-account sign-in restore the same preparation on laptop/phone layouts.

## Context and ownership

User confirms **Aditya owns screen-share monitoring and assessment backend**, to integrate later. Arpan owns the lab UI reference in sibling kiki-web/ui/arpan-a11y; adapt that experiment/readiness/checkpoint flow to existing Services/session/router rather than import its global fixture store or simulated connections. Akshita's auth/profile/material/assessment flow remains intact.

## Decisions and boundaries

- Preparation has its own small API/DTO; the provisional execution/lease/evidence LabApi is not implemented or simulated. No completion ticks, capture, verified evidence, score, pointer or blue proficiency update.
- Same Google UID protects all reads/writes. A copied /labs/{id} path is a locator, not a bearer capability. No share token or credentials in links. Saved Kiki notes do not save the Simulink model; projectRef is student-entered text only.
- Catalog version pinned at creation; original checkpoints retained. Readiness derives from the same version's server assessment summaries. All preparation remains available before checks pass. Only the specified seven checks determine theory readiness; chapter test does not gate lab.
- One preparation per owner/practical/catalog version; transactional starts are repeat-safe. Revisioned updates reject conflicts; unsaved text is retained with Reload saved / explicit review before replacing. No device control lease is claimed for preparation.
- Fixtures are labelled and development-only. Connected HTTP never falls back. Existing billing/Storage/IAM remain unchanged.

## Now / Next / Later

1. Now: typed Python practical projection/preparation store/routes and ownership/revision/version tests; React contract and adapters.
2. Next: responsive selection/tracker, prediction and observation drafts, visible save/retry/conflict, copy session link, Home resume; browser + live Firestore save/resume.
3. Later: Aditya supplies monitoring/assessment protocol. Align trusted observation, frame/session identity, freshness, readiness, leases and pointer activation before integrating. Physical phones remain a separate acceptance step.

## Verification and risks

Reject injected ownership/provenance/readiness/completion fields. Public response hard-codes pending monitoring/false pointer/no assessment. Account change aborts reads/writes; deep links preserve auth return. Form drafts are never silently discarded on navigation or conflicts. Repeated sessions and stale concurrent writes must not duplicate or overwrite saved notes.

## Cold pickup

Last completed: Python/Firestore preparation API, React selection/tracker, draft protection, copied URL, Home resume and owner/version tests. Live session created, checkpoint 2/revision 1 restored after reload. 78 Python / 96 frontend / full 60 browser plus final 8 lab rechecks pass. Exact next: student review; later Aditya protocol alignment per apps/web/LAB_PREPARATION_CONTRACT.md. No fake evidence/scores, billing/IAM/Storage/deploy/Git changes.
