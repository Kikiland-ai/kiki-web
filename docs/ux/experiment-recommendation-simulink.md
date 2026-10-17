# Recommended browser lab: DSB-SC modulation and coherent demodulation

12 October 2026 · Research recommendation; experiment selection and browser execution not yet confirmed

**Recommendation:** use **Double-sideband suppressed-carrier (DSB-SC) amplitude modulation and coherent demodulation** as the first medium-difficulty ECE experiment in MATLAB/Simulink Online.

**Student goal:** “I can put a message onto a carrier, recover it at the receiver, and explain why matching the receiver carrier matters.”

## Why it fits Kiki

- It connects several concepts through a single transmitter-to-receiver model, with visually distinct input, modulated, and recovered waveforms.
- It creates meaningful pointer steps: finding blocks, dragging them onto the canvas, branching/connecting signals, entering parameters, opening scopes, running, comparing, and debugging.
- It supports a clear fault: a receiver carrier phase/frequency mismatch. Kiki can point to the output and ask why recovery changed before directing the student to the relevant parameter.
- The teaching model can be designed using ordinary Simulink **Sine Wave, Product, Gain, Transfer Fcn, and Scope** blocks. Building the modulation and receiver stages explicitly exposes the reasoning.
- It fits ECE communication/signal-learning content. It is not assumed to be a first-semester Basic Electronics experiment: the lab page must teach its specific prerequisites.

“Medium difficulty” is our design assessment of the bounded build-and-debug task, not a difficulty rating assigned by MathWorks. Target roughly 30–45 minutes of guided lab work after prerequisite learning; validate that estimate with students.

MathWorks documents DSB-SC modulation/demodulation and an example that plots the input, modulated, and demodulated signals. Its packaged example uses Communications Toolbox; our proposed basic-block teaching model is an adaptation, not a claim that their example is toolbox-free. [Modulator and example](https://www.mathworks.com/help/comm/ref/dsbscammodulatorpassband.html), [demodulator](https://www.mathworks.com/help/comm/ref/dsbscamdemodulatorpassband.html).

## Alternatives considered

| Candidate | Strength for this project | Reason for the recommendation |
|---|---|---|
| DSB-SC modulation + coherent demodulation | Transmitter/receiver sequence, multiple outputs, parameter changes, meaningful mismatch fault | Recommended balance of visible learning and pointer interactions |
| Full-wave bridge rectifier with capacitor filter | Familiar electronics, circuit connections, ripple/load comparisons | Strong alternative if the chosen syllabus stays with diodes; adds physical-model setup and dependency checks |
| Lowpass filtering of a noisy signal | Clear before/after result and filter tuning | Good fallback; a narrower signal path unless deliberately expanded |

MathWorks provides examples of a [bridge rectifier with capacitor](https://www.mathworks.com/help/simscape/ug/full-wave-bridge-rectifier.html) and [noisy-signal filtering in Simulink](https://www.mathworks.com/help/dsp/ug/filter-frames-of-a-noisy-sine-wave-signal-in-simulink.html). Those published models have their own product requirements; availability must be checked on the actual account.

## Teach only the required concepts

Before guided execution, teach or reuse passed checks for:

1. Signal amplitude, frequency, and phase; reading a waveform.
2. Message signal versus carrier signal.
3. Multiplication as DSB-SC modulation.
4. Coherent demodulation and carrier alignment.
5. Lowpass filtering and recovering the message.

Explain the required frequency units and block parameters within the relevant concept/step. Each required concept check uses the agreed **60% minimum**. Preparation is available anytime; the full chapter and its **80% chapter test do not gate this lab**.

## Student execution and observable checkpoints

| Stage | Student action | Checkpoint for Kiki |
|---|---|---|
| Open | Select experiment; open the Simulink model workspace; connect guidance | Correct experiment/workspace and active connection |
| Generate | Place message and carrier sources; set amplitude, frequency, and phase | Blocks and parameter values |
| Modulate | Add a Product block and connect the sources | Transmitter signal path and modulated waveform |
| Receive | Add the local carrier, receiver Product, lowpass stage, and recovery gain | Receiver connections and parameters |
| Compare | Run and inspect original, modulated, and recovered outputs | Successful run and interpretable waveform evidence |
| Investigate | Change the receiver carrier phase/frequency as instructed | Observed change in recovery and student's prediction |
| Debug | Diagnose and correct the mismatch; rerun | Corrected parameter, run, and output comparison |
| Explain | Record observations and a short Odia/English explanation | Evidence of why the receiver needs carrier alignment |

The student performs all actions. The pointer highlights and explains; it does not place blocks, connect them, or run the model automatically. Observable checkpoints require an actual integration; screenshots/manual confirmation are labelled when used.

## Model design to trial

Suggested starting design: a low-frequency message multiplied by a substantially higher-frequency carrier; multiply again by a matched receiver carrier, lowpass-filter the result, and restore its amplitude with a Gain block. Compare the recovered waveform after the filter's startup transient, allowing for the filter's amplitude/phase response rather than demanding an identical overlay.

A deliberate **90° receiver phase mismatch** is a useful fault: ideal coherent recovery suppresses the message component, while a real finite filter can leave high-frequency residuals. Restoring the carrier phase should restore recovery. This is a model-design prediction to verify in the browser trial.

Keep the initial model bounded: one sinusoidal message, one transmitter, one receiver, one lowpass stage, and one debug case. Channel noise, audio input, spectrum analysis, and carrier-recovery loops can be extensions.

Basic block references: [Sine Wave](https://www.mathworks.com/help/simulink/slref/sinewave.html), [Product](https://www.mathworks.com/help/simulink/slref/product.html), [Gain](https://www.mathworks.com/help/simulink/slref/gain.html), [Transfer Fcn](https://www.mathworks.com/help/simulink/slref/transferfcn.html), [Scope](https://www.mathworks.com/help/simulink/slref/scope.html). For the time-based Sine Wave block, frequency is entered in rad/s; avoid confusing this with dedicated modulation blocks that use Hz.

## Browser feasibility and remaining verification

MathWorks states that Simulink Online supports model editing and simulation. MATLAB Online basic includes Simulink and has a 20-hour monthly limit. This makes a small basic-block model a plausible accessible starting point, but does not verify a particular account, the completed model, or our overlay. [Online support/limitations](https://www.mathworks.com/products/matlab-online/limitations.html), [online versions and access](https://www.mathworks.com/products/matlab-online/matlab-online-versions.html).

Before fixing lab screen details: verify the student's account access, build/run the model online, check baseline/fault/recovery outputs, choose simulation settings, and test whether the supported guidance connection can observe and highlight each checkpoint. Save the model in the external workspace and associate its reference with the Kiki session for device resumption.

## Lab page and activation

The top-right **Lab mode** icon opens Kiki's tracking page. The page offers experiment selection and prerequisite preparation and then tracks the selected experiment alongside Simulink. It displays current step, completed/pending checkpoints, connection state, and observations.

**Hey Clickky 2.0 activates only after:** experiment selected → required concept checks passed → Simulink/model workspace opened → guidance connection confirmed. Entering Lab mode alone leaves the pointer inactive. Pause, disconnect, and end-session controls stop observation and guidance appropriately.

**Next action:** confirm this candidate, then perform the real browser/integration trial. Research completed; no MATLAB model or pointer integration was executed in this task.
