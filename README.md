# Kiki web

One responsive React + TypeScript application for laptops and phones, with a Python/Firebase backend. The combined frontend is under `apps/web`; `apps/api` contains its current Python service.

**[Team setup and ownership](TEAM_HANDOFF.md)** · **[Current frontend status](apps/web/active.md)** · **[Student walkthrough](docs/ux/ui-slice-review.md)** · **[Current contracts](docs/CONTRACT.md)**

```sh
cd apps/web
npm ci                 # Node 24.12+
npm run dev            # http://127.0.0.1:5173 — labelled browser-only sample
```

Google-only sign-in and real Firestore learning run separately on 5174 with Python on 8000 and your own approved local configuration. No credentials or real learner records are shipped. See TEAM_HANDOFF.md for both terminals and validation commands.

Implemented: profile/onboarding, enrollment, chapter map and bilingual lessons/glossary, server-scored checks/progress, saved lab preparation/continuation and interactive DSB-SC teaching diagrams. Cloud original-file uploads, reviewed narration and Aditya's screen-share monitoring/assessment remain pending. No active lab pointer or verified practical evidence is claimed.

Arpan's original work is preserved in this branch's ancestry and original feature branches. The old root-level scaffold is superseded by the single app in apps/web. Do not build a second frontend from the reference contract.
