# ece-dsb-receive-drift: Receiving DSB-SC (envelope, filter and drift)

Status: **draft** (content and both languages). Difficulty: hard. Course `CRS-AC-ECE`.
Files: `ece-dsb-receive-drift.json` (tutor question), `ece-dsb-receive-drift.routing.json` (29 labelled replies).

## The problem

A DSB-SC signal s(t) = 2cos(2π·10³t)·cos(2π·10⁵t) V arrives at a receiver (message m(t) = 2cos(2π·10³t), fc = 100 kHz).

- (a) Which frequencies does it contain, and what bandwidth does it occupy?
- (b) What does an envelope detector give? What is the smallest carrier A·cos(2π·10⁵t) to add so that an envelope detector works?
- (c) A coherent receiver (product with a unit-amplitude local oscillator, ideal LPF, gain 2). Where should the LPF cutoff go?
- (d) The local oscillator drifts to 100.05 kHz. What comes out, and how often does it fade to zero?

This is the usual mixed exam and GATE pattern: DSB-SC spectrum, then AM modulation index and the envelope-detection condition, then coherent detection with a frequency-offset local carrier.

Ledger concepts it mixes: C-AM-04 (DSB-SC, sidebands), C-AM-03 (AM envelope, modulation index), C-AM-06 (coherent demodulation, recovery gain), C-AM-07 (lowpass cutoff), C-AM-08 (frequency mismatch, beating), and C-AM-05 (SSB contrast, a single note only). FM/PM (C-AM-09/10) are not used. Superheterodyne/IF is outside the ledger, so it was not considered.

## Worked solution (all numbers checked numerically by correlation over 20 ms at 2 MHz sampling)

**(a)** 2cosA·cosB = cos(A−B) + cos(A+B), so s(t) = cos(2π·99·10³t) + cos(2π·101·10³t).
That gives lines at 99 and 101 kHz, 1 V each, and **no line at 100 kHz**, because m(t) has no DC. Bandwidth B = 2fm = **2 kHz**. Sideband power is 2 × ½ = 1 W into 1 Ω.

**(b)** The DSB-SC envelope is |m(t)| = 2|cos(2π·10³t)|. The phase reverses at each zero crossing, so the sign is lost.
Fourier content of |m(t)|: 4/π ≈ 1.27 V DC, 8/(3π) ≈ 0.85 V at 2 kHz, ≈ 0.17 V at 4 kHz, … and **zero at 1 kHz**. The detector cannot return the tone at all.
Adding a carrier gives s_AM = [A + 2cos(2π·10³t)]cos(2π·10⁵t) = A[1 + (2/A)cos(…)]cos(…). So μ = 2/A, and μ ≤ 1 requires **A ≥ 2 V**, which means A_min = 2 V (μ = 1).
Cost: carrier power A²/2 = 2 W against 1 W of sidebands, so η = 1/3 = μ²/(2+μ²) at μ = 1.

**(c)** v(t) = s(t)·cos(2π·10⁵t) = cos(2π·10³t) + ½cos(2π·199·10³t) + ½cos(2π·201·10³t).
The cutoff must sit above 1 kHz and well below 199 kHz (e.g. **5 kHz**). After the LPF you have cos(2π·10³t) = m(t)/2, and gain 2 gives back m(t).

**(d)** With LO = cos(2π·100050t): y(t) = 2·LPF{s(t)·LO} = m(t)cos(2π·50t) = 2cos(2π·10³t)cos(2π·50t) = **cos(2π·950t) + cos(2π·1050t)**.
The USB (101 kHz) lands at 950 Hz and the LSB (99 kHz) lands at 1050 Hz. The 2fc terms at 199.05 and 201.05 kHz are filtered out.
The envelope is 2|cos(2π·50t)|, which is zero every 1/(2·50) s = 10 ms (at 5, 15, 25 ms …). So the output **fades 100 times per second** (2Δf).

Why: DSB-SC places the message in two mirror sidebands. A frequency mismatch moves them apart in opposite directions, and the two tones beat. With SSB (USB only), the same drift would just move the tone to 950 Hz.

## Why these stages

| Stage | Probes | Purpose |
|---|---|---|
| `spectrum` | p-spectrum | Spectrum first. Every later step reasons about the two sidebands. It catches the conventional-AM "carrier line" confusion early. |
| `envelope` | p-envelope, p-carrier | Why the cheap detector fails (sign lost). Then the AM fix (μ = 2/A ≤ 1) and its power price. Ties C-AM-03 to C-AM-04. |
| `coherent` | p-lpf | Product detector spectrum and the cutoff choice (C-AM-07). It sets up the product-then-filter maths that stage 4 reuses. |
| `drift` | p-freq, p-fade | The hard part. The qualitative and spectral result (two tones), then the checkable number (100 fades/s). |
| `explain` | p-explain | English articulation of the mechanism (metric `articulation`), then a conclusion tying the three receiver options together. |

That makes 7 probes in total. Every branch of a probe, including misconception branches, reveals that probe's answer items when it resolves. Remediation `show` nodes only focus or reveal non-answer items (notes, terms). Answer items are uncovered only by the probe's own branches or its `answer` hint rung.

## Misconception catalogue

| id | Fires at | Source |
|---|---|---|
| `carrier-line-in-dsb` | p-spectrum | Classic DSB-SC vs AM confusion. Haykin & Moher Ch. 3 and Lathi & Ding Ch. 4 both stress that the DSB-SC spectrum has no discrete carrier component. Wikipedia DSB-SC: two sidebands, with the carrier "ideally being completely suppressed". |
| `M-AM-03` (ledger) | p-envelope | Ledger C-AM-03. Wikipedia DSB-SC: an envelope detector "is unable to receive the signal properly". Haykin & Moher Ch. 3 (envelope of DSB-SC is |m(t)|; phase reversals). |
| `any-carrier-enough` | p-carrier | Overmodulation μ > 1 distorts envelope detection. Wikipedia AM: "If m > 1 then overmodulation occurs". Lathi & Ding Ch. 4, condition μ ≤ 1. |
| `offset-shifts-tone` | p-freq, p-fade | Question-local. Students carry over SSB intuition (a drift shifts pitch). In DSB the two sidebands move oppositely and beat. Wikipedia DSB-SC: output ½f(t)cos(Δωt+θ), "a cyclic inversion of the recovered signal". |
| `M-AM-06` (ledger) | p-freq | Ledger C-AM-06 ("arbitrary carrier frequency or phase"). Here, "50 Hz is tiny next to 100 kHz". |

Ledger M-AM-04 ("suppressed carrier means no signal") was left out to stay within 3 to 5 misconceptions. The `show-*` remediation lines still cover it in passing.

## Sources

- S. Haykin, M. Moher, *Introduction to Analog and Digital Communications*, 2nd ed., Wiley, 2007. Ch. 3 (AM, envelope detection, DSB-SC, coherent detection).
- B. P. Lathi, Z. Ding, *Modern Digital and Analog Communication Systems*, 4th ed., OUP, 2009. Ch. 4 (DSB-SC, AM with μ ≤ 1 and η = μ²/(2+μ²), local-carrier frequency/phase error).
- Wikipedia, "Double-sideband suppressed-carrier transmission" (demodulation with Δω, θ). Wikipedia, "Amplitude modulation" (modulation index, overmodulation, carrier vs sideband power).
- Ledger `analog-modulation.json`: concepts C-AM-03/04/06/07/08, fault card F-AM-FREQ.

The textbook locators are chapter-level from the author's knowledge of these standard texts. Section and page numbers were **not** checked against a physical copy. The two Wikipedia pages were read directly while authoring.

## Reviewer checklist

- [ ] Physics: (a) 99/101 kHz, 1 V each, B = 2 kHz; (b) |m(t)| has no 1 kHz content, A_min = 2 V, η = 1/3; (c) cutoff 1 kHz < fc_LPF < 199 kHz; (d) y = cos(2π·950t) + cos(2π·1050t), 100 fades/s.
- [ ] Judgement call: "smallest A" is taken as A = 2 V (μ = 1 exactly, envelope just touches zero). A strict reading ("μ < 1") gives "A > 2 V". Both route to `a-min-2`.
- [ ] Judgement call: in p-lpf, a cutoff of 100 kHz is labelled `cutoff-between`, because an ideal filter between 1 and 199 kHz works. A practical-design reviewer may prefer to call it poor.
- [ ] Waveform `fig-wave-dsb` draws the carrier at 12× the tone (not 100×) for legibility. The caption says so.
- [ ] Spectrum figures use one-sided cosine amplitudes (1 V lines for s(t), not ½ V two-sided).
- [ ] Odia renditions are machine-drafted, with technical terms kept in English. They need native review (especially the hint lines and the `note-eff` / `note-ssb` notes).
- [ ] Routing set: 29 replies; every branch at least once; each misconception twice; 3 unclear; 2 off_topic; 8 romanised/mixed and 2 Odia-script; 3 router-discipline cases (p-lpf 100 kHz, p-freq "1050 and 950", p-fade "50 Hz but 100").
- [ ] Next steps: `nextSteps` references `ece-phase-error` (the sibling question) and the DSB-SC lab fault F-AM-FREQ (2010 vs 2000 Hz, which gives 20 fades/s).

Validation run: pydantic `TutorQuestion` passes. `kiki_api.tutor.validate` gives 0 errors and 0 warnings. An independent self-check (references, reachability, acyclicity, chip routes, answer-only-once-earned, routing labels per node) passes, and it catches injected faults.
