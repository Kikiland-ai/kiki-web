# Arpan chapter-map and lesson review

15 October 2026 · Source pulled/reviewed; feature integration remains next.

## Source and checkout

User supplied https://github.com/Kikiland-ai/kiki-web. Cloned it to `../kiki-web` alongside Design-Thinking, preserving all current app/API files and ignored configuration. Its `main` is still scaffold commit `e0a41aa`; the features are on Arpan's branches.

Reviewed cumulative head **22560772ea92d19007204928c5404bdc3b60d4fd**, remote `ui/arpan-a11y`, local **review/arpan-ui**. Its history includes kit → fixtures → chapter map → lesson → manual lab → pointer kit → demo controls → integration preparation → accessibility fix. The isolated checkout is clean; no remote merge, push or deployment was performed.

## What works now

- Ten concepts grouped into four chapter sections; text statuses, four-part ring, next-concept link, DSB-SC missing prerequisites and chapter-test link.
- All ten concept lesson payloads, four placards each; 1–5 language dial, English technical terms, Odia pronunciation/meaning/example sheet, sources, next/back and browser-persisted position.
- Explicit **Fixture mode** and **Draft content** labels. The standalone preview preloads six sample concept passes; those are not Akshita's account or actual quiz results.
- Shared kit is typed React/CSS modules; scope of reviewed files includes map/lesson, service stand-ins, fixture content/store, router/placeholders, UI tokens/components, package/lock and tests. No claim that every repo file or lab workflow was reviewed.
- Manual-lab tracker and pointer components exist in the branch; this review does not establish actual Simulink observation or Hey Clickky integration.

## Actual verification

- `npm ci` completed using the repo lockfile and Node 24.
- **205 tests / 28 files passed**, including 8 map tests and 9 lesson tests, plus kit/fixtures/lab tests.
- `npm run lint`, `npm run typecheck` and an explicit `VITE_APP_MODE=live npm run build` pass.
- Browser: map → C-AM-08 lesson; dial 5 → phase-error term details still show Odia pronunciation/meaning; next placard → reload resumes Step 2 of 4; return to map shows Learning without adding a passed check.
- Both map and lesson checked at **320, 360, 390, 430, 768, 1024, 1280, 1440px**; no document/main horizontal overflow detected. Temporary viewport override reset afterward.
- Physical phones, 200% text zoom, keyboard overlay, all ten lessons' full content, expert ECE/Odia review and actual lab execution remain unverified.

## Required integration changes

1. **One session and progress source.** `src/features/learning/services.ts` currently chooses a global fixture adapter; non-fixture mode rejects requests. `src/fixtures/store.ts` preloads six passes in its own storage. Replace the stand-in through the existing authenticated service composition. Feed the map from the same latest-attempt overview as the existing quiz UI; never copy six synthetic passes into the real profile.
2. **One router/app.** The Arpan checkout's auth/Home/Library/Profile/quiz routes are placeholders. Register/adapt learning routes under the current Gate and shell; retain working Google/profile/onboarding/material/assessment routes. Avoid replacing the current router/services wholesale with the other repo's stubs. A later deliberate consolidation into the shared kiki-web repo must preserve those features and keep local env/ADC out of commits.
3. **Profile-owned dial and durable position.** Replace global `kiki.dialLevel` with the validated saved profile preference; use owner-scoped positions. `LessonScreen.tsx` currently swallows save errors; show unsaved/retry state before claiming durable continuation. Python content/progress/position endpoints remain to implement; Cloud Storage is not needed to serve the supplied draft chapter as explicitly catalog content.
4. **Keep fixture code out of connected builds.** The explicit live build still contains `FIXTURE-RUN-AM-` seeded run IDs and `kiki.fixture.v1`. This is a real bundle-isolation gap, although live service methods currently reject instead of returning these fixtures. Error classes imported from the fixture barrel and its module-level store are part of the dependency chain. Move shared errors out of fixtures, use build-eliminable fixture imports and verify final assets. Do not describe local/live mode as integrated based on the build passing.
5. **Use the current checked toolchain when porting.** `npm audit` in the isolated checkout reports **5 advisories: 3 critical, 1 high, 1 moderate**. Affected names: happy-dom, vitest, tinypool, react-router, @vitest/mocker. This is dependency audit output, not evidence of a running exploit. Do not copy this older lockfile over the current app or use a blind force-update. Review/upgrade compatible versions before production use.
6. **Preserve content/progression decisions.** Four broad concepts and ten atomic concepts keep IDs. All ten ≥60% concept checks gate chapter test (10 questions; ≥80%). Only 01/02/03/04/06/07/08 gate DSB-SC execution, with preparation available anytime. Reading is not a pass. Reconcile the concept-ring label/meaning: map nodes currently show quiz accuracy, whereas the implementation plan recommends assigned-work coverage. Current map is grouped tiles/phone rows; dependency wires/prerequisite explanations need review against the journey. Odia key ideas/section titles include documented fallbacks and need review.

## Next implementation slice

Wire map + one lesson into the current working app first: labelled preview → lesson placard/term/dial → existing AS-AM-08 check → result → updated map from that same assessment store. Keep map data, position, profile and assessments behind their service contracts. Add combined integration tests for no duplicate progress, reload/sign-out, missing prerequisites, language persistence and phone layouts. Then connect Python content/position and authoritative progress/assessment endpoints. Storage remains a separate colleague-owned investigation, with no payments or billing changes authorized.

## Open the preview

- Current working connected app: http://127.0.0.1:5174 (real Google/profile/Firestore; no cloud originals yet).
- Existing browser-only full-flow sample: http://127.0.0.1:5173.
- **Arpan's standalone review:** http://127.0.0.1:5180/chapters/LP-ANALOG-MODULATION.
- Click **Continue: Carrier mismatch and debugging**. Move the dial; tap a technical word; use the four lesson steps. Return using **Learn**.
- Quiz, Home, Library and sign-in in this standalone review remain placeholders. It is not yet the combined application.

To restart the Arpan preview, from the isolated `kiki-web` checkout: `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort` with Node 22+ (Node 24 was used for this check). Fixture mode is its default. Do not copy the real Firebase env or Admin credentials there for this preview.

Last completed: pulled/reviewed cumulative feature branch, ran checks, verified browser/width behavior and documented integration gaps.
Exact next action: integrate learning modules through the current session/assessment service boundaries, with fixture isolation and owned saved preferences/positions; no merge/push/deploy requested.

## Follow-through — combined preview integrated (15 October)

The agreed integration was subsequently implemented in Design-Thinking/apps/web, retaining the current app/toolchain. Map now uses the same assessment records, profile dial and owned positions, with visible save errors; fixture records/scoring are excluded from connected production assets. Source checkout remains unchanged for comparison. Use 5173/learn for combined preview and apps/web/active.md for latest checks. Python teaching/position/assessment and actual lab/media remain pending. Earlier findings in this review describe the source snapshot, not unresolved defects in the adapted preview.
