# Tutor mode runbook: switch it on with a paid Gemini key

Tutor mode ships **off**. It turns on only when the API has `KIKI_TUTOR_ENABLED=true` and a
server-side `KIKI_GEMINI_API_KEY`. Nothing else in the API changes, and a tutor failure at
startup disables only the tutor (profiles, lessons and labs keep working).

Placeholders: `<PROJECT>` (kiki-512012), `<REGION>` (the region `kiki-api` runs in),
`<SA>` (the Cloud Run runtime service account). Run these as an account with access to the
project. Nothing here needs the key to appear on a command line or in shell history.

## 1. Before you start

- A Gemini API key from an AI Studio project **with billing on**. The free tier fails the
  preflight's quota check and Live refuses with "prepayment credits are depleted".
- Models: `gemini-3.5-flash-lite` (reply labelling and the report summary) and
  `gemini-3.8-live` (voice). Override with `KIKI_TUTOR_CLASSIFIER_MODEL` / `KIKI_TUTOR_LIVE_MODEL`.

## 2. Preflight on your machine (2 minutes)

```sh
cd apps/api
read -rs KIKI_GEMINI_API_KEY && export KIKI_GEMINI_API_KEY   # paste, Enter; not echoed
PYTHONUTF8=1 uv run python scripts/tutor_preflight.py
# with application default credentials for the project, also check Firestore:
KIKI_FIREBASE_PROJECT_ID=<PROJECT> PYTHONUTF8=1 uv run python scripts/tutor_preflight.py --firestore
PYTHONUTF8=1 uv run python scripts/tutor_image_check.py    # the image carries every tutor file
```

Expect `RESULT: READY`. Each line says what failed and why (quota, model access, voice).
The Firestore check writes one throwaway session under `learners/preflight-*` and deletes it.

## 3. Store the key in Secret Manager

```sh
gcloud secrets create kiki-gemini-api-key --project <PROJECT> --replication-policy automatic
printf '%s' "$KIKI_GEMINI_API_KEY" | gcloud secrets versions add kiki-gemini-api-key --project <PROJECT> --data-file=-
gcloud run services describe kiki-api --project <PROJECT> --region <REGION> --format 'value(spec.template.spec.serviceAccountName)'   # → <SA>
gcloud secrets add-iam-policy-binding kiki-gemini-api-key --project <PROJECT> \
  --member serviceAccount:<SA> --role roles/secretmanager.secretAccessor
```

## 4. Deploy a tagged revision with no traffic

Build the image as usual (`cloudbuild.api.yaml`), then:

```sh
gcloud run deploy kiki-api --project <PROJECT> --region <REGION> --image <IMAGE> \
  --no-traffic --tag tutor \
  --update-env-vars KIKI_TUTOR_ENABLED=true \
  --update-secrets KIKI_GEMINI_API_KEY=kiki-gemini-api-key:latest
curl https://tutor---<service-url-host>/tutor/health
# → {"enabled": true, "reason": "ok", "questions": [...], "classifierModel": "...", "liveModel": "..."}
```

If the web preview will call this tagged URL, add the preview origin to `KIKI_CORS_ORIGINS`
(exact origin, no wildcard) in the same `--update-env-vars`.

## 5. Web preview, then the walkthrough

```sh
cd apps/web
# .env.production.local: VITE_API_BASE_URL=<tagged or main API URL>; other VITE_FIREBASE_* as today
npm run build && firebase hosting:channel:deploy tutor --project <PROJECT>
```

Walk it signed in: C-AM-08 → Talk it through → finish once by typing and once by voice (allow
the microphone) in Odia and English → scorecard → revision sheet.

## 6. Go live, and how to undo it

```sh
gcloud run services update-traffic kiki-api --project <PROJECT> --region <REGION> --to-tags tutor=100
# undo, either:
gcloud run services update-traffic kiki-api --project <PROJECT> --region <REGION> --to-revisions <PREVIOUS>=100
gcloud run services update kiki-api --project <PROJECT> --region <REGION> --update-env-vars KIKI_TUTOR_ENABLED=false
```

Optional for a demo window: `--min-instances 1` avoids a cold start on the first turn (costs money).

## What to watch

| Log line (logger `kiki_api.tutor`) | Meaning | Action |
|---|---|---|
| `Tutor disabled at startup (…)` | Content or config failed; tutor answers 503 | Check `/tutor/health` reason; run the preflight |
| `Tutor classifier fell back to unclear (ClientError)` | Rate limit or quota | Paid tier? quota for the classifier model |
| `Voice token unavailable (…)` | Live token minting failed | Students continue by typing; check billing |
| `Tutor summary unavailable (…)` | Summary call failed | Report still shows; no action |

Student text is never logged. The key is read from the environment only.

## Built-in limits

| Limit | Value | Where |
|---|---|---|
| Classifier timeout / retries on 429 | 12 s / 1 retry after 1.5 s, then a hint | `tutor/classifier.py` |
| Voice tokens per session | 8 (each single-use, 30 min, config locked server-side) | `tutor/service.py` |
| Events per session | 3000 | `tutor/service.py` |
| Reply length | 2000 characters | `tutor/routes.py` |
| Voice resumes after a drop | 3 per voice start | `web/src/features/tutor/useVoice.ts` |

## Cost per session (estimate; measure with the paid key)

About 6–10 labelling calls (flash-lite, under 1k tokens each), one summary, and a few minutes
of Live audio (DeepMind lists gemini-3.8-live input at about $0.84 per audio hour). A 5-minute
voice session is in the order of cents.
