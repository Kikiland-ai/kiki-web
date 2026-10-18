# Backend and operator requests — draft, not sent

18 October 2026, India time. Source revisions: web/API `44d2a0847a16b09fcdbfc865dcc5007f2d33a189` plus uncommitted local continuation changes; backend source `f2dca8b806e4002411b5704e19f0f40681093298`. Current source/byte evidence: [coverage ledger](../evidence/concept-coverage-2026-10-18.json).

## Existing audio bytes (backend/content owner)

Expected: immutable WAV bytes matching the saved packet. Observed: every path below contains a Git LFS pointer (not a WAV). Materialize the **existing** assets using LFS or a verified archive; do not generate replacements for compatible recordings. All are Odia (`or`); English is absent in this recovered batch. C-AM-08's separate web package already has English/Odia and must be preserved.

| Concept | Placard(s) / scope | File | Expected bytes | Expected SHA-256 |
|---|---|---|---:|---|
| C-AM-01 | CARD-AM-01-definition / placard | CARD-AM-01-definition.or.wav | 977634 | `25c90241fd2429ccb539a2f086ca091ee10a5cf7191f19de12e99af45f0f2e3e` |
| C-AM-01 | CARD-AM-01-concept / placard | CARD-AM-01-concept.or.wav | 2361954 | `271a8af8291f1a3e2e5cee5000facb8cc744339dab97212a22444d76d0563b93` |
| C-AM-01 | CARD-AM-01-application / placard | CARD-AM-01-application.or.wav | 783714 | `df5303354538f8d60d84f53a586b91fe32a43afd0049303bc54e0089616fb38b` |
| C-AM-01 | CARD-AM-01-recap / placard | CARD-AM-01-recap.or.wav | 829794 | `fd4bd5c7a75d3cbcaf2b55d6dac1b0a06792f124265ad8f2d16b2c70236f9389` |
| C-AM-02 | CARD-AM-02-definition / placard | CARD-AM-02-definition.or.wav | 559074 | `eaa1ef235581d45f0a0a9787e2c6ffdc55d23fa8d19a43af5d873c9d5d7cf7e0` |
| C-AM-02 | CARD-AM-02-concept / placard | CARD-AM-02-concept.or.wav | 1760994 | `f84c81a6e9929ed2ef4761d7858fd168a259a2bfcaaf8ec4cdd53ae6bbd90aa1` |
| C-AM-02 | CARD-AM-02-application / placard | CARD-AM-02-application.or.wav | 443874 | `67d77f19f885000c7905aa825ad9f9de656c8bd7b68233dec108963aad0f761b` |
| C-AM-02 | CARD-AM-02-recap / placard | CARD-AM-02-recap.or.wav | 595554 | `b7b245795bbf7642ac2ea26fe28cfb096f9a512f2aabdf00e048b17850850431` |
| C-AM-03 | CARD-AM-03-definition / placard | CARD-AM-03-definition.or.wav | 1021794 | `3d5eddba917790dc9558f1ebe140f0aaa3320160b0430e34d0bf467f8073f652` |
| C-AM-03 | CARD-AM-03-concept / placard | CARD-AM-03-concept.or.wav | 2634594 | `d4e806484921fb4b205485c956f7c9ea6134cfc36167fa4b95b45efd43d785dc` |
| C-AM-03 | CARD-AM-03-application / placard | CARD-AM-03-application.or.wav | 376674 | `fbecfe3c85aa7e85f5a9fc4ff71a7368774a104d862fa2156ac58470a99925dd` |
| C-AM-03 | CARD-AM-03-recap / placard | CARD-AM-03-recap.or.wav | 522594 | `ac8f98989bd55bd38909353e5bbc7df0fdaed2a736db79095a9b7efb2bf31fca` |
| C-AM-04 | CARD-AM-04-definition, CARD-AM-04-concept, CARD-AM-04-application, CARD-AM-04-recap / concept | C-AM-04.or.wav | 3986274 | `510482f37fce1a7031ede6f03378bcdaf9f1ea5647b690315174e0fd75a2c2ef` |
| C-AM-05 | CARD-AM-05-definition, CARD-AM-05-concept, CARD-AM-05-application, CARD-AM-05-recap / concept | C-AM-05.or.wav | 3020514 | `1546077d7d5c4cd0e2f6e16cf43cbfaaf62b32a7080806ea84965dd78cbcc928` |
| C-AM-06 | CARD-AM-06-definition, CARD-AM-06-concept, CARD-AM-06-application, CARD-AM-06-recap / concept | C-AM-06.or.wav | 3926754 | `231312a668e5ab23161ba882d32059886eb8b5adf7fd5eccd91bb580231fc79f` |
| C-AM-07 | CARD-AM-07-definition, CARD-AM-07-concept, CARD-AM-07-application, CARD-AM-07-recap / concept | C-AM-07.or.wav | 3429474 | `279d82e7d73489a27643e7263bcaeb16085236a84811573e659cd2285411d2ce` |
| C-AM-08 | CARD-AM-08-definition / placard | CARD-AM-08-definition.or.wav | 674274 | `05af66931e3c7cc3198016f579182d2e0fdb46d4572c6592e13ed98d5addf390` |
| C-AM-08 | CARD-AM-08-concept / placard | CARD-AM-08-concept.or.wav | 1926114 | `efb9ec714456093b505994753f0919504ba728067d0a5874ee665ad106620630` |
| C-AM-08 | CARD-AM-08-application / placard | CARD-AM-08-application.or.wav | 503394 | `b53dd2227bbdd7dc728a400c35fb42ca7843c4133c5d428b14446f4ecd57972d` |
| C-AM-08 | CARD-AM-08-recap / placard | CARD-AM-08-recap.or.wav | 537954 | `4628ebc6a120880caa8297561f7a43708fefbc662fc53d87e5d86cb1edff8b12` |
| C-AM-09 | CARD-AM-09-definition, CARD-AM-09-concept, CARD-AM-09-application, CARD-AM-09-recap / concept | C-AM-09.or.wav | 3389154 | `26b9221db1e80b4b772d54e66a9070341a4eef615a19d9a6ecafa86c21117559` |
| C-AM-10 | CARD-AM-10-definition, CARD-AM-10-concept, CARD-AM-10-application, CARD-AM-10-recap / concept | C-AM-10.or.wav | 3974754 | `7a4e4f944d01629a1d1d1e5c57e31e9e17d367bdce45daac7f5e54f401c9259f` |

## Whole-concept contract (backend/content owner)

C-AM-04/05/06/07/09/10 recordings cover all four placards of their concept. Current `concept-media-manifest/v1` only accepts a single placard per rendition. Expected: a true per-placard recording per supported language, or a separately agreed explicitly labelled whole-concept player/contract. Observed: six recordings are excluded by `prototypes/concept_library/web_adapter.py`. This slice retains that boundary and requests actual per-placard assets; it does not request regeneration of the 16 compatible existing placard recordings. No inferred sentence timings.

## Scene definitions (web implementation owner; backend supplies provenance)

Expected: trusted native renderers with validated units/bounds/comparisons, numeric behavior checks and source hash bindings. Observed: registry contains `dsb-sc-visual/v1` and `coherent-phase-recovery/v1`; other recovered kinds remain unsupported. This is remaining local implementation work, not proof that the saved scenes are missing. Exact packet revisions and scene hashes are in the ledger:

| Concept | Recovered kind | Saved scene SHA-256 | Native status |
|---|---|---|---|
| C-AM-01 | signal | `63a1f6904c54a00774aeb2812602949ead455502f3410a24ebc394cbbcde6b10` | trusted renderer and Python/Zod projection required |
| C-AM-02 | flow | `baa31dbd91a3e5f93a16d789a0e448a366dcf20a1843702b49336d27406e2c2c` | trusted renderer and Python/Zod projection required |
| C-AM-03 | am | `0186554d72a6c4abc18b94bd766f8faf8fa8fee2bdf9eccdab43df7f3e3c76a8` | trusted renderer and Python/Zod projection required |
| C-AM-04 | dsb | `faac3169a793890d2b38dfa7b2945deae23f0291a33348b37f42bc0ea1e10534` | existing lesson.visual is separate from recovered scene |
| C-AM-05 | spectrum | `0faa40b437f8cf12f0c03397b7d62fae6cf780dbd0b76acd0d4d98d87b61f929` | trusted renderer and Python/Zod projection required |
| C-AM-06 | receiver | `cca026d946e4a47d18afc0dc64b98bb99f18a390a21b1bf04559be8d8ab6a17b` | trusted renderer and Python/Zod projection required |
| C-AM-07 | filter | `5232f62d77adc27473010ff88e61738b2bcce2b8731df662f769759149f55733` | trusted renderer and Python/Zod projection required |
| C-AM-08 | phase_recovery | `50d800b8a4aad21334741ea157a93c550689348ed786eb01b3e2b5b8f7c83157` | supported projection |
| C-AM-09 | fm | `84c9542028c271c25f1ce6f73764a976db8c97ef240a984b4d78dd977ac633cd` | trusted renderer and Python/Zod projection required |
| C-AM-10 | pm | `263b56d6232b7b189bb493711d0dc53b74e9500bfb4c0efb87d65f7e4706ba54` | trusted renderer and Python/Zod projection required |

## Private delivery (operator/cloud owner)

Current local setting has no `KIKI_MEDIA_BUCKET`. Expected: select an **already approved existing private bucket**, with the existing API identity's object-read permission and publisher's object-create permission. Then authorize a dry-run-reviewed additive media publication with the native publisher and explicit expected-current revision where replacing. Do not create a bucket, broaden IAM/billing, run publisher `--apply`, import a catalog or reset learner data as setup. Need real manifest/asset HTTP responses and actual audible playback before PASS. Code and dry runs do not substitute for those checks.

## Atomic creation receipt (backend owner)

Expected: lab state creation and its durable idempotency receipt commit atomically, including crash/restart recovery. Observed: backend PR #7/source above still uses separate durable operations. The new web/API recovery reuses the saved operation key/body and cannot reserve a fresh operation in explicit recovery mode. A dropped-response transport regression returns the same execution; this is not a crash-atomicity test. Add a forced-crash-between-operations regression and eliminate that window in the backend. No backend source was changed here.

## Extension and real learner acceptance (operator)

The web bridge now prevents request-ID reuse across remounts and overlapping hello replies, and ignores stale ownership/binding replies. New deterministic regressions reproduce failures on original source; no canonical extension source/permissions were changed or rebuilt. Still required: actual extension mount/reload/reconnect, page/window coherence and sign-out cleanup with the changed app. Reverify Windows runtime provenance/tunnel/canonical zero-model smoke before any live lab trial. Operator chooses MATLAB tab and initiates sharing; a paid trial requires bounded authorization.

Learning acceptance also needs operator-controlled sign-in, an agreed assessment write path, actual narration/artifact operation and reload continuation. No real student response/confirmation or assessment answer was submitted by this slice. Four canonical offline backend policy tests used synthetic JPEG/findings and student text only; they are not twelve-checkpoint learner acceptance.
