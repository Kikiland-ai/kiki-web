# ece-am-envelope-design: Designing an AM envelope detector

Status: **draft** (content and both languages). Difficulty: hard. Course `CRS-AC-ECE`.
Files: `ece-am-envelope-design.json` (tutor question) and `ece-am-envelope-design.routing.json` (32 labelled replies).

## The problem

s(t) = 10[1 + 0.6cos(2π·5×10³t)]cos(2π·10⁶t) V feeds a diode envelope detector. Its load is R = 10 kΩ with C in parallel. Assume an ideal diode, and normalise powers to 1 Ω.

- (a) Find the carrier, sideband and total power, and the efficiency η.
- (b) Between which limits must RC lie, and why?
- (c) Find the largest RC for which the output still follows the envelope, and choose C.
- (d) μ is raised to 0.9. Does the detector still work? What must change, and how much does η gain?

This is a typical end-semester or GATE problem on standard AM and the envelope detector. It mixes all four strands of the brief:

| Strand | Where it appears |
|---|---|
| Property knowledge | Why RC ≫ 1/fc (the capacitor holds the carrier peaks). Why RC is bounded above (the capacitor can only fall at rate v/RC). Why the bound depends on μ (a deeper envelope falls faster). Why the window closes as μ → 1. |
| Formulas to recall | Pc = Ac²/2, P_SB = μ²Pc/2, η = μ²/(2+μ²), 1/fc ≪ RC ≪ 1/fm, RC ≤ √(1−μ²)/(μωm), ωm = 2πfm. |
| Applying them to numbers | 50 W, 9 W, 59 W, 15.3%, 1 µs and 200 µs, 42.4 µs, 4.24 nF, 15.4 µs, 1.54 nF, 28.8%. Each slip gives a recognisably wrong number: 68 W, 65 W, 60%, 26.5%, 23%, 267 µs, 97 µs. |
| Design and judgement | Choosing a standard C inside both bounds with margin (p-choose). Diagnosing that the same part fails at μ = 0.9 and re-specifying it (p-mu09). Explaining the efficiency against detector trade-off (p-explain). |

## Candidates considered

| Candidate | Property | Formula recall | Numbers | Design/judgement | In ledger? | Verdict |
|---|---|---|---|---|---|---|
| **Envelope detector design for standard AM** (chosen) | Strong: ripple vs. diagonal clipping, and the μ-dependence of the clipping limit | Strong: power, η, both RC bounds, ω = 2πf | Strong: about 10 numbers, each with a distinct wrong value for each slip | Strong: choose C, then diagnose and re-design at μ = 0.9 | Yes. C-AM-03 ("time constant is suitable", envelope, μ), C-AM-04 (sidebands), C-AM-07 (lowpass), C-AM-01 (Hz vs rad/s, M-AM-01) | **Chosen** |
| Multi-tone AM (μt = √(μ1²+μ2²)) | Moderate: the overmodulation check | Moderate: μt, power and bandwidth | Good | Weak: little to choose, mostly plug-in | Partly. The ledger's C-AM-03 is single-tone only, and μt is not in the ledger | Rejected: thin on judgement and off-ledger |
| Superheterodyne (IF, LO range, image f_s + 2f_IF) | Good | Good | Good | Good: IF choice | **No.** The ledger has no IF, mixer-receiver or image concept | Rejected: outside the ledger scope |

The chosen question is more technical than the two existing ones. `ece-phase-error` is a single cos φ factor. `ece-dsb-receive-drift` touches μ = 2/A and η = 1/3 only in passing. This question needs a derived inequality, a part selection, and a re-design when a parameter changes. It reuses no probe from either sibling: the drift question's `p-carrier` asks for the minimum carrier, while this one starts from a given μ and designs the receiver.

## Worked solution (every number checked by `C:\Users\ASUS\.claude\jobs\439fb17a\tmp\am_env_check.py`)

**(a) Power.** The carrier is Ac = 10 V, so Pc = 10²/2 = **50 W**. Each sideband line has amplitude μAc/2 = 3 V and power 3²/2 = 4.5 W, so P_SB = μ²Pc/2 = 0.18 × 50 = **9 W**. The total is P_t = Pc(1 + μ²/2) = **59 W**.
Efficiency is η = P_SB/P_t = 9/59 = μ²/(2+μ²) = 0.36/2.36 = **15.3%**, so about 85% of the power is carrier.
Common wrong answers: dropping the ½ gives 18 W, 68 W and η = 26.5%. Using μ for μ² gives 15 W, 65 W and η = 23.1%. Taking η = μ gives 60%.

**(b) The RC window.** Tc = 1/fc = 1 µs and Tm = 1/fm = 200 µs, so **1 µs ≪ RC ≪ 200 µs**.
- If RC is too small, C empties between carrier peaks and the carrier leaks out as ripple.
- If RC is too large, C can only discharge at rate v/RC. When the envelope falls faster than that, the output lags in a straight line. This is diagonal (negative-peak) clipping.

**(c) The sharp limit.** The envelope is E(t) = Ac(1 + μcos ωm t). The output can follow it only if E/RC ≥ |dE/dt| = Acμωm sin ωm t at every instant, which gives RC·ωm ≤ (1 + μcos x)/(μ sin x) with x = ωm t. The minimum over x is at cos x = −μ, where it equals √(1−μ²)/μ. So

  RC ≤ √(1−μ²)/(μωm), with ωm = 2π·5000 = 31 416 rad/s.

At μ = 0.6 this gives RC_max = 0.8/(0.6 × 31 416) = **42.4 µs**, and with R = 10 kΩ, C_max = **4.24 nF**. A brute-force minimum over x matches to 10⁻⁹. Using fm in place of ωm gives 266.7 µs, which is 2π too large. Dropping the square root gives 34.0 µs, and omitting √(1−μ²) entirely gives 53.1 µs.

Design: choose **C = 2.2 nF**, so RC = 22 µs. That is 22 carrier periods, with about 4.4% droop per carrier cycle, and roughly half the 42.4 µs limit. Any C from about 1 to 4.2 nF can be defended.

Simulation check: an ideal diode with an RC peak detector, run at 40 samples per carrier cycle over 0.1–0.4 ms. The figure is the maximum amount by which the output exceeds the true envelope:

| μ | C | RC | Overshoot above envelope |
|---|---|---|---|
| 0.6 | 2.2 nF | 22 µs | 0 |
| 0.6 | 4.2 nF | 42 µs | 0 |
| 0.6 | 4.7 nF | 47 µs | 0.18 V (clips) |
| 0.6 | 10 nF | 100 µs | 3.2 V |
| 0.9 | 2.2 nF | 22 µs | 0.46 V (clips) |
| 0.9 | 1.5 nF | 15 µs | 0 |

**(d) Raising μ to 0.9.** The limit becomes RC_max = √0.19/(0.9 × 31 416) = 0.436/28 274 = **15.4 µs**. That is below 22 µs, so the 2.2 nF detector now **clips**. The fix is C ≤ 1.54 nF, so fit **1.5 nF** (RC = 15 µs, still 15 carrier periods). This value also works at μ = 0.6.
Using Hz by mistake gives 96.9 µs, and you would wrongly conclude that nothing needs to change.
The gain is η(0.9) = 0.81/2.81 = **28.8%** (20.25 W of 70.25 W), up from 15.3%.
As μ → 1, RC_max → 0 (it is 4.5 µs at μ = 0.99), while RC must stay ≫ 1 µs, so the window closes. And η can never exceed 1/3.

## Why these stages

| Stage | Probes | Purpose |
|---|---|---|
| `power` | p-power, p-eff | Formula recall and arithmetic first, where the three classic power slips each produce a distinct number that the router can catch. |
| `window` | p-window | Property knowledge: what each end of the RC range physically protects against. Shows the block diagram and the AM waveform. |
| `clipping` | p-clip, p-choose | The hard formula (derived on the board via `note-slope`), the Hz/rad/s trap, then a real part choice graded on `design-judgement`. |
| `deeper` | p-mu09 | Diagnosis: the same part fails when μ changes, so re-specify it. Then `show-eta09` reveals what the deeper modulation bought (η 15.3% → 28.8%) and that the window closes as μ → 1. |
| `explain` | p-explain | Saying the trade-off in English (`articulation`), then a conclusion. |

That makes 5 stages and 7 probes. Every branch of a probe reveals that probe's answer items. Remediation `show` nodes only focus, or reveal non-answer items (`eq-power`, `fig-spec`, `note-47`, terms). Formula items (`eq-power`, `eq-eta`, `eq-clip`, `note-slope`, `step-wm`) are not answer items. They appear at the worked_step rung, or once the probe resolves, so the board reads as a full worked solution by the end.

Figures:
- `spectrum`: carrier and the two 3 V sidebands. Revealed by a hint, or by the sideband-no-half remediation.
- `waveform` ×2: the AM wave with its envelope (the carrier is drawn at 20× the tone, not 200×, and the caption says so), and the μ = 0.6 and μ = 0.9 envelopes.
- `block`: source → diode + R‖C → DC block → output.

## Misconception catalogue

| id | Fires at | Wrong number | Source |
|---|---|---|---|
| `sideband-no-half` | p-power, p-eff | 18 W, 68 W, 26.5% | Each sideband line is μAc/2, so P_SB = μ²Pc/2 (Lathi & Ding Ch. 4; Haykin & Moher Ch. 3, chapter-level). A standard exam slip. |
| `mu-not-squared` | p-power, p-eff | 15 W, 65 W, 23% | Power follows amplitude squared (same chapters). |
| `eta-equals-mu` | p-eff | 60% | μ is the envelope depth, (Emax−Emin)/(Emax+Emin), per ledger C-AM-03. η = μ²/(2+μ²) ≤ 1/3 (Lathi & Ding Ch. 4). |
| `rc-carrier-only` | p-window, p-choose, p-mu09 | "100 nF", "nothing changes" | Wikipedia "Envelope detector": τ must be "small enough to track quickly-falling envelope slopes". EEEGuide: too large an RC gives diagonal clipping. |
| `M-AM-01` (ledger) | p-clip, p-mu09 | 267 µs, 97 µs | Ledger C-AM-01 / M-AM-01 (Hz vs rad/s). The clipping bound uses ωm. |

## Sources

- S. Haykin, M. Moher, *Introduction to Analog and Digital Communications*, 2nd ed., Wiley, 2007. Ch. 3: AM power and the envelope detector, with the condition 1/fc ≪ R_lC ≪ 1/W. **Chapter-level only.** This condition is the version quoted in course notes found while authoring, not checked against the book.
- B. P. Lathi, Z. Ding, *Modern Digital and Analog Communication Systems*, 4th ed., OUP, 2009. Ch. 4: AM sideband power, η = μ²/(2+μ²), envelope detector. **Chapter-level only.**
- Wikipedia, "Envelope detector": 1/f_carrier ≪ τ ≪ 1/f_max, and RC small enough to track falling slopes. Read while authoring.
- EEEGuide, "Linear Diode Detector or Envelope Detector": RC large compared with a carrier cycle, and too large an RC gives diagonal clipping. Read while authoring. Its formulas are images, so they were not read.
- Stanford EE133 lecture notes, peak detector: derives the optimum RC against diagonal clipping by minimising a slope inequality. **Seen only through search-result excerpts.** The PDF refused connections, so the printed form was not verified there.
- The diagonal-clipping bound √(1−μ²)/(μωm) was derived independently (above) and checked by brute-force minimisation and by time-domain simulation.

## Reviewer checklist

**ECE teacher**
- [ ] Numbers: 50 / 9 / 59 W; η 15.3%; window 1–200 µs; RC_max 42.4 µs (C ≤ 4.24 nF); C = 2.2 nF; μ = 0.9: 15.4 µs, C = 1.5 nF, η 28.8%.
- [ ] Judgement call: the diagonal-clipping criterion is the standard ideal-diode slope test, RC ≤ √(1−μ²)/(μωm). It ignores diode drop, source resistance and the AC load of the next stage. Some texts state the bound with the AC/DC load ratio instead (m ≤ Z_ac/R_dc). That variant is not used here.
- [ ] Judgement call: in p-choose, any C of about 1–4.2 nF is graded ok. Values of about 0.5 nF or less are partial (`c-too-small`), and 4.7 nF or more is not_yet. The 0.5–1 nF band is left to the classifier. A teacher may want a stricter "≥ 10 × Tc" rule.
- [ ] Judgement call: `formula-slip` (partial) groups a unit slip ("42.4 ms") with algebra slips (34 µs, 53 µs). Decide whether "42.4 ms" deserves partial or not_yet.
- [ ] Power and efficiency are not spelled out in ledger C-AM-03's text, but they are standard for conventional AM, and the sibling question already uses η = μ²/(2+μ²).
- [ ] `waveform` figures draw the carrier at 20× the tone for legibility. The spectrum uses one-sided cosine amplitudes.

**Odia speaker**
- [ ] All Odia is a machine draft in the polite ଆପଣ register, with technical terms kept in Latin script. Check the hint lines in p-clip and p-mu09, `note-window-why`, `note-slope` and `note-mu1` especially.
- [ ] The romanised replies in the routing file use common spellings (tenu, karan, bhag kale, lagaibi). Check that they read naturally.

**Routing set:** 32 replies covering every branch. Each misconception appears at least twice (`rc-carrier-only` three times). There are 3 unclear, 2 off_topic, 9 mixed/romanised (28%) and 3 in Odia script (9%). Three router-discipline cases:
1. p-window: right numbers with wrong physics → `window-no-why`.
2. p-choose: the right C plus a tolerance caveat → `c-in-window`.
3. p-clip: "42.4 milliseconds", a near-miss unit slip → `formula-slip`.

## Validation

- `PYTHONUTF8=1 uv run python scripts/tutor_validate.py ../../data-model/tutor/questions/ece-am-envelope-design.json` → `PASS: 0 errors, 0 warnings`.
- `PYTHONUTF8=1 uv run pytest -q tests/test_tutor_content.py tests/test_tutor_engine.py` → 43 passed. This includes the schema/validator check and the exhaustive engine walk on this file.
