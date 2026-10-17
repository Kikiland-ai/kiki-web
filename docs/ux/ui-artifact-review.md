# UI artifact review and reconciliation

Reviewed: 13 October 2026
Repository: `88a155a` on main; existing local data-model changes preserved
Implementation plan: [UI phases and completion gates](../plans/ui-implementation-plan.md)

The exports are useful screen/component references. They demonstrate interactions, not a connected Firebase application, actual generated speech, validated marking, or a shipped Simulink extension. Prefer the user's confirmed requirements when references disagree. A decision attributed to another reviewer is recorded below as a handoff decision/recommendation rather than silently promoted to the user's instruction.

## Supplied artifact inspection

All seven supplied paths were accessible. The ZIP contains the five HTML files in `Downloads/share`; each archived HTML is byte-identical to its loose copy. Both walkthrough variants were compared; the share copy includes newer 12 October decisions and a five-notch dial that the root Downloads version lacks.

| File | SHA-256 prefix | What was inspected / implication |
|---|---|---|
| `Downloads/Kiki Journey Walkthrough.html` | `dfc164b69149` | Older 34-screen walkthrough source. Retains unresolved colour/integration flags; do not choose it over the updated share copy. |
| `Downloads/share/Kiki-journey-walkthrough.html` | `d1b03bfe5fe4` | 34 screens/12 stages, screen/control specs, flags, dial, tracker and all local action handlers. Browser inspection of welcome, software connection and its simulated open transition. |
| `Downloads/share/Breadboard-design-system.html` | `aaff14f3bc53` | Component/token/type/asset catalog and preview structure; compared with current repo README/tokens/component API and guides. |
| `Downloads/share/Kiki-clickable-demo.html` | `bc055f4d8ec9` | React component bundle and 21 application screens; browser inspection of screen navigation and diode lesson. Disclaimer explicitly says voice/camera/sign-in are simulated. |
| `Downloads/share/Kiki-journey-review-handoff.html` | `12e3d007a581` | Full review text: four stated decisions, resolved flags, seventeen remaining items, proposed document edits. Its “feasibility settled” assertion is not reproduced by the supplied code. |
| `Downloads/share/Kiki-UX-working-doc.html` | `b621fd5326d3` | Export structure and relevant decisions, foundations, component/screen inventory, material intake, lesson, assessment, written practice, practicals and shared system states. Older build/feature priorities are historical context. |
| `Downloads/share/Kiki-offline-files.zip` | `8d9512fb995d` | Archive inventory and byte comparison against all five loose exports; no extension package or backend included. |

These are local source references, not live Claude documents. Export banners note that live edits may be newer. No inaccessible live document was assumed current; no claim is made that every preview/flag was interactively tested.

## Repository references inspected

- [Backend prototype directions](../prototypes/backend-prototype-directions.md): all seven prototypes, speech/scene/image/live-screen contracts, evidence/curation, proposed Firebase boundaries and acceptance requirements.
- [Backend handoff](../plans/backend-prototype-handoff.md): priorities, risk boundaries and cold-pickup continuation. Its historical checkout/status text is not today's implementation state.
- [Backend repo setup](../backend-repo-setup.md) and `tools/backend-starter/firestore.rules`, `storage.rules`: pinned `9a7f369` context export; rules deny all access. No backend checkout/services were verified here.
- [Student journey](student-journey-odia-ece.md), [lab recommendation](experiment-recommendation-simulink.md), [Analog Modulation package](../../data-model/ANALOG-MODULATION.md), relevant types, pure runtime helpers and validators: confirmed scores/lab gate plus the local new case. The recommendation's “candidate pending” wording predates the user's selection.
- [Design-system README](../../design-system/project/README.md), [tokens](../../design-system/project/tokens.json), `components/index.d.ts`, KikiWalkthrough/LabGuide/VoiceScope/AnswerOverlay guides and prototype shell: reusable UI, current colours and remaining mock behavior.
- Repository AGENTS and BB8 harness/specialist reference guidance. No older `docs/spec/` phase files were adopted as implementation authority or edited.

## Conflicts to reconcile before implementation

| Reference behavior | Evidence | Plan treatment |
|---|---|---|
| Diode learning followed by DSB-SC lab; five required concepts shown | Walkthrough hard-coded concepts and lab-prep count | User's Analog Modulation case supplies ten chapter concepts and **seven** lab prerequisites. |
| Blue concepts / green lab still occur in older text/screens | UX export foundations; clickable `MeScreen` uses explicit old colours even though kit references may be newer | Resolve by semantic dimension keys and current green/red/yellow/blue mapping. Audit screen-specific CSS/SVG values too. |
| Warm paper/Baloo/Noto UI | Repo tokens and older demo | User's white/Google Sans UI requirement wins. Retain Odia fallback and legible plotting surfaces. |
| Account creation after first lesson or sign-in as a later extra | Older feature/build flow | Account-first Firebase sign-up/login is Phase 2, before private material. |
| One/two quick checks can mark a concept mastered | Older lesson-player specification | Keep user's 4–5 concept checks, default five, ≥60%; separate theory passage from all-dimension mastery. |
| Saved term or demo navigation fills progress | Local synthetic state and demo jump handlers | Only evaluated evidence updates the corresponding projection. Unassessed dimensions remain labelled. |
| Language-support usage is “evidence” | Older UX dial text | Store preference/interaction telemetry; do not count choosing Odia as proficiency failure or English improvement. |
| Units treated as a language gap | Older diagnostic copy | Wrong units can be a domain/quantity error. Diagnose against an explicit rubric; do not automatically classify them as weak English. |
| Fixed `stepMs`, browser English speech, simulated VoiceScope | Component guides and inline bundle | Replace with reviewed mixed-language audio and actual timing/MediaRecorder/transcript flows where applicable. |
| Fake processing and canned exam scores | Clickable demo `setTimeout` and hard-coded reports | Real jobs/attempts/results; labelled fixtures only in fixture mode. |
| Sharing a tab appears to prove overlay activation | Walkthrough `open`/`open2` handlers only set local numbers | Observation, extension overlay and workspace/controller verification are separate live prerequisites. |
| “Working demo exists; feasibility settled” | Review handoff assertion; backend proposal calls integration unverified | Record reported mechanism as preferred direction; reproduce its code/test on real Simulink before release. |
| Auto-run/apply fix or planted fault | Older practical UI and in-app LabGuide | Students deliberately perform all real Simulink actions. Guidance never executes them. |
| Snap is missing from recent journey | Review F11 vs older clickable demo and backend prototype 6 | Include one actual written-answer → repair → retest flow; defer expanded timed papers. |
| Context snapshot already contains newest data | Exporter reads pinned committed Git tree | Local Analog Modulation files need review/versioned transfer; no implicit backend import. |

## Review flags mapped to implementation

“Proposed” means this plan supplies a recommendation; it does not change the original review document's status or assert student approval. “Requirement” means it follows the user's existing directions.

| Flag | Treatment | Phase / status |
|---|---|---|
| F01 colours | Green concepts, blue practical; semantic order matches current repo kit | 0–1; requirement already reflected in kit, audit old screens |
| F03 one chapter | Analog Modulation learning and DSB-SC lab in the same course | 0/4/7; user-selected case |
| F05 dial | Five notches in onboarding/concept header; only student moves it | 2/4; referenced design behavior |
| F06 starting support | Equivalent sentence preference sets suggested starting dial, confirmed by student | 2; recommendation from handoff |
| F04 ring evidence | Three-term practice + normal English invitation, separate evaluated dimensions | 5; proposed; extra term items required |
| F02 annotation placement | Calibrated target/transform/version/expiry/geometry invalidation/pass-through rules | 0/7; specified in plan, actual adapter trial pending |
| F07 phone clipboard | Same-account Resume lab main path; preserve copy-link, QR/code convenience | 7; proposed refinement preserving requested link |
| F08 phone after handoff | Read-only laptop progress and explicit take-control/reconnect | 7; proposed |
| F09 naming | Kiki pointer in student UI; Hey Clickky 2.0 internal name | 1/7; proposed |
| F10 lesson guidance | Chapter-specific examples and real synchronized Kiki walkthrough | 4; actual media/scene work required |
| F11 exam repair | One-answer Snap/report/repair/retest in first complete build | 6; proposed scope |
| F12 sign-up | Google-only Firebase access with one “Sign in with Google” action for new/returning users | 2; latest user choice supersedes email/password; provider not configured |
| F06b ratings | Keep both out-of-ten ratings on one screen; confidence only | 2; preserves user requirement |
| F13 duplicated language | Welcome helper pre-fills onboarding, with Change | 2; proposed |
| F14 fonts/background | White/Google Sans + Odia fallback through shared tokens | 1; user requirement; tokens not yet changed |
| F15 lab entry duplication | Four global tabs, top-right Lab mode and contextual Resume | 1/7; proposed, common route |
| F16 processing return | Durable job plus Home/Library status; refresh/return/retry | 3; specified |
| F17 repeated misses | Second failed attempt offers alternative explanation; third offers prerequisite | 5; proposed policy; no automatic dial change |
| F18 MathWorks access | Separate sign-in/access check in real tool, recorded/manual fallback labelled | 0/7; trial pending; export's quota claim not treated as a verified current limit |
| F19 chapter entry | All ten chapter concept checks ≥60%; lab only seven required checks | 5; explicit distinction |
| F21 primary colour | Neutral ink generic primary, dimension colours for skill-specific signals | 1; proposed |

## Review boundary and next action

No Firebase project, provider, backend API, real media engine, `.slx` file or extension was configured/tested during this planning task. Native-speaker/domain review is still required for draft content. HTML artifacts and existing user files remain unchanged.

Next: apply Phase 0 reconciliation as implementation work and reproduce the handoff's real-tool adapter. The user's latest choice is Google-only sign-in. Use the [implementation plan](../plans/ui-implementation-plan.md) as the single sequence of build/acceptance gates, with contracts shared between frontend and backend.
