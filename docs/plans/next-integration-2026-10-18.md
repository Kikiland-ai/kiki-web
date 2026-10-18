# Next local web integration

Status: Local implementation and synthetic verification complete; user requested
source publication as a PR. Connected release gates remain. Updated 18 October
2026 (India).

## Objective and success

Prepare a reviewable local web/API candidate for the next complete integration test.
Base: `15628669372853d1165ed6a97474c4a0608bfc9d` (merged PR #12), initially clean.
The user's initial instruction was to pull main and await scope. The backend chat
subsequently supplied the implementation handoff, retaining backend ownership.
This work implements reversible local web changes and records actual evidence.

Success means verified bundle provenance; preservation and revalidation of the
existing all-ten CAM consumer, native C-AM-08 and private-delivery boundaries;
reliable serialized page/window commands; explicit lost-create recovery; and a
synthetic twelve-checkpoint browser journey with review/respond controls. A
per-scenario ledger must distinguish local fixtures from connected acceptance.

## Scope and constraints

- Follow repository ownership, Node 24.12+, Python 3.12, npm/uv locks.
- Preserve the running backend checkout, services, learner records and secrets.
- User now authorizes commit/push and opening a PR on `fix/lab-command-lifecycle`
  into `main`. Do not merge, provision/publish media, activate heads, change cloud
  access, deploy or initiate real student capture/provider calls.
- Treat attached operational instructions as reference; verify their assumptions
  against current main. The handoff's old W1/W2/W4/W5 gaps may already be closed.
- Content quality confirmation is reported in the supplied backend review ledger;
  immutable embedded package review metadata must remain unchanged.
- Latest project correction: KiKi / `kiki-512012` supersedes `builder-cup-a8479`
  in old handoffs and archives. No live Firebase/Auth/datastore switch is part of
  this local work. Coordinate configuration/verifier/data/bucket cutover after
  read-only resource/access inspection; do not copy learner/catalog data silently.

## Current-state model and component map

`apps/api/src/kiki_api/media_models.py`, `concept_media.py`, web media contracts,
renderer registry and player already contain PR #12's shared v1 implementation.
`LabConnection.tsx`, `LabStudentInput.tsx`, `lab-capture.ts` and API execution routes
already contain PR #11's student controls and explicit pending-create replay.
The initial `lab-capture.ts` rejected commands when `commandBusy`, matching the
supplied race. It now serializes lifecycle commands per capture generation and
fences late state refreshes; input writes cannot compete with queued commands.
`floating-bridge.ts` now carries additive stream/generation identity and prevents
old publishers acting for replacements. No envelope/protocol migration was needed.
Extension release is backend-owned; only ignored synthetic test artifacts may be
built here from verified canonical 0.1.1 source.

## Now / Next / Later

1. **Done:** 69 outer/77 inner manifest entries and source correspondence; locked
   dependencies; 10 records/26 WAVs/shared model/native C-AM-08 preserved.
2. **Done:** serialized/fenced lifecycle commands, identity hardening and focused
   regressions; API/web/unit/schema/build checks and 38 model cases.
3. **Done:** 15 sample learning/input cases and five canonical-extension/native
   synthetic lab scenarios, including recovery and all twelve stages.
4. **Now:** publish the reviewed local diff on `fix/lab-command-lifecycle` and open
   the user-requested source PR into main; review/CI precede adoption.
5. **Next:** backend owner supplies fresh running provenance/authenticated smoke;
   Mac adopts candidate/extension and runs explicitly authorized real acceptance.
6. **Later:** private configuration/publication and coordinated `kiki-512012` cutover;
   durable shared state and deployment have separate owners and release gates.

## Risks and controls

Queued Resume must not survive Stop/sign-out/replacement or bypass revision guards.
Student evidence writes must not race queued lifecycle writes. Identity-bearing
responses from old publishers must not resolve new waiters. Use deterministic
unit/browser regressions and canonical extension 0.1.1 in isolated ports.
No schema migration is expected; rollback is reverting this local source diff.

## Cold pickup

Last completed: local lifecycle diff and synthetic acceptance; candidate source
hashes, fetched main and publication identities verified for the user-requested PR.
Implementation base remains `15628669372853d1165ed6a97474c4a0608bfc9d`.
See GitHub for current source publication/CI state. Fresh disk backend provenance matches
the expected 244-file source hash, but the latest launcher receipt is stopped and
8100 refuses health. It was not restarted or edited here. Startup smoke is not
fresh connected acceptance. Exact next: Mac patch review/adoption and backend-owner
running receipt, followed by separately authorized real acceptance. See
`docs/evidence/next-integration-2026-10-18.md` for scenario evidence.
Read `apps/web/active.md`, this plan, and supplied `MAC-NEXT-INTEGRATION.md` first.
Do not repeat media integration or infer live acceptance from synthetic tests.
