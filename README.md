# kiki-web

The student web app for Kiki: bilingual (Odia–English) learning for engineering students. One React app serves laptops and phones.

**Hackathon demo (submission 18 Oct 2026):** lesson → quiz → DSB-SC lab, on the Analog Communication → Analog Modulation chapter.

**Team contract:** [docs/CONTRACT.md](docs/CONTRACT.md) covers IDs, routes, the shared kit, the API and the timeline.

## Run it

Needs Node 22 or later.

```sh
npm ci
npm run dev        # http://127.0.0.1:5173
```

Checks before every merge:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Modes

`VITE_APP_MODE` picks the data source. Copy `.env.example` to `.env.local` to change it.

| Mode | Data | Banner |
|---|---|---|
| `fixture` (default) | Labelled sample data behind the service interfaces | "Fixture mode" shown on every screen |
| `local` | Python API + Firebase emulators on this laptop | none |
| `live` | Deployed API + Firebase project | none |

Fixture data is never a real learner's progress. Don't present it as live results.

## Who owns what

| Folder | Owner | Contents |
|---|---|---|
| `src/ui/` | Arpan | Shared kit and tokens: the single source of truth for colour, type and components |
| `src/media/` | Arpan | Audio player, diagrams, teaching annotations |
| `src/features/learning/`, `labs/` | Arpan | Chapter map, lessons, terms, lab tracker |
| `src/app/` | Akshita | Router registration, guards, shell wiring |
| `src/services/` | Akshita | Auth, API and Firebase clients |
| `src/features/auth/`, `onboarding/`, `home/`, `library/`, `assessment/`, `profile/` | Akshita | Sign-in, onboarding, quiz and reports |
| `src/contracts/`, `src/fixtures/`, `package.json` | Both, one editor per change | Shared data shapes and sample data |

Feature owners export their routes (`features/*/routes.tsx`); `src/app/routes.tsx` registers them. Screens not built yet live in `src/features/placeholders/`.

## Fixed decisions

- React + TypeScript (Vite); Python backend (FastAPI); Firebase Auth, Firestore and Storage.
- Only "Sign in with Google".
- White background; Google Sans for English, Noto Sans Oriya for Odia.
- Green = concepts, red = technical words, yellow = academic English, blue = practical. Always pair colour with a word or icon.
- Generic primary buttons are neutral ink; dimension colours mark skill-specific signals.
- Concept check passes at 3/5 (60%); chapter test at 8/10 (80%). The lab needs only concepts C-AM-01, 02, 03, 04, 06, 07, 08.
- In Simulink the student performs every action; Kiki only points, explains and checks.

## Layout contract

| Width | Layout |
|---|---|
| ≥ 1024px | Navigation rail on the left, bounded reading width |
| < 1024px | Four bottom tabs: Home · Learn · Library · Profile |
| < 600px | One column, 16px gutters, 48px touch targets |

Lab mode is the top-right icon at every width.

## Reference material

Plans, content and the design system come from the Design-Thinking repo and Akshita's `Arpan_UI` handoff bundle. Key sources:

- `docs/plans/ui-implementation-plan.md`: routes, phases and rules
- `data-model/cases/analog-modulation-odia.json`: chapter content, questions and lab steps
- `design-system/project/`: Breadboard components, tokens and Kiki artwork

Port components into `src/ui/` as typed modules. Don't bundle the exported demo HTML or `window.Breadboard` globals.
