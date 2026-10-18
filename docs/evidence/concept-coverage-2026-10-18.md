# Analog Modulation source and media coverage — 18 October 2026

This is an **offline inventory**, not connected learner acceptance. [Full 80-row ledger](concept-coverage-2026-10-18.json) records every placard/language, catalog/packet/source revision, text hash, narration scope and expected/observed asset hash/size. Connected API, browser playback/artifact operation and reload/cleanup remain **NOT RUN** for every row.

Web base: `44d2a0847a16b09fcdbfc865dcc5007f2d33a189`. Backend source: `f2dca8b806e4002411b5704e19f0f40681093298`. Catalog: `am-51187527300cba2fa3cca868`. All 40 placards × two languages match exact app source text. No Kannada/Marathi support is claimed.

All 22 backend WAV paths are Git LFS pointers: 16 placard recordings (C-AM-01/02/03/08) and six whole-concept recordings. The separate existing web C-AM-08 package contains eight hash/size-verified English/Odia clips; its native dry-run additionally verifies WAV format, duration/peak, script/text hashes and scene bindings. It still builds to `cm-e0f086007cc9f2062af093f3`. No new audio generation or replacement was performed.

Current ignored trial configuration was checked by boolean only: private media bucket **not configured**. Consequently connected private delivery is **BLOCKED**; original services/configuration remain unchanged. Packet publication fields mean recovered-source metadata (`not_published`), not a fresh query of Firestore media heads. Native-language, pronunciation and scientific review remain pending.

Dial 1/2/3 use Odia as primary; dial 4/5 use English. Dial 3 also displays English and allows an explicit narration-language choice. Dials do not create additional audio renditions. Whole-concept audio is never counted as a placard clip.

| Concept | Placards / text | Local English placard audio | Local Odia placard audio | Recovered narration scope | Web artifact support | Connected acceptance |
|---|---|---|---|---|---|---|
| C-AM-01 | 4 / PASS | 0/4 | 0/4 | placard | missing trusted renderer | NOT RUN |
| C-AM-02 | 4 / PASS | 0/4 | 0/4 | placard | missing trusted renderer | NOT RUN |
| C-AM-03 | 4 / PASS | 0/4 | 0/4 | placard | missing trusted renderer | NOT RUN |
| C-AM-04 | 4 / PASS | 0/4 | 0/4 | whole concept (incompatible) | C-AM-04 native diagrams; recovered scene unsupported | NOT RUN |
| C-AM-05 | 4 / PASS | 0/4 | 0/4 | whole concept (incompatible) | missing trusted renderer | NOT RUN |
| C-AM-06 | 4 / PASS | 0/4 | 0/4 | whole concept (incompatible) | missing trusted renderer | NOT RUN |
| C-AM-07 | 4 / PASS | 0/4 | 0/4 | whole concept (incompatible) | missing trusted renderer | NOT RUN |
| C-AM-08 | 4 / PASS | 4/4 | 4/4 | placard | phase-recovery renderer | NOT RUN |
| C-AM-09 | 4 / PASS | 0/4 | 0/4 | whole concept (incompatible) | missing trusted renderer | NOT RUN |
| C-AM-10 | 4 / PASS | 0/4 | 0/4 | whole concept (incompatible) | missing trusted renderer | NOT RUN |

Local code still required: trusted renderer/contracts/projections for the other recovered scene definitions. Existing C-AM-04 diagrams are separate from its recovered scene. Missing-renderer support has not been implemented in this slice.

External prerequisites and source-specific requests are in [the backend request draft](../plans/backend-requests-2026-10-18.md). The draft has not been sent. The [continuation plan](../plans/connected-learning-continuation.md) records actual commands and remaining local/live work.
