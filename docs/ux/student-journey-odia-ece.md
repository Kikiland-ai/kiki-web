# Kiki: an Odia-speaking ECE student's journey

12 October 2026 · Journey proposal before UI work

This journey follows the user's clarification and confirmed updates on 12 October. Their stated requirements take precedence over conflicting earlier UX ideas. The decision table records agreed choices and remaining preparation.

**Student:** Bikash, an ECE student who understands Odia better than English, studies on his phone, and performs software experiments on a laptop.

**Journey:** Open Kiki → sign up / log in → choose language → home → add subject and materials → chapter map → concept placards → concept quiz → chapter test → lab preparation → software or hardware lab → saved progress.

## 1. I open the hosted Kiki link

I see a white welcome page, the KIKI logo, a short description, and **Create account** / **Log in**. The first “Ki” scrolls upward through regional-script versions and settles on English; the second “Ki” stays still. The animation is brief, skippable, and static with reduced motion.

The opening interface uses simple English. A visible language chooser, with language names in their own scripts, lets me get Odia help before account creation. Kiki does not assume my language from my location. A returning student logs in and resumes their saved activity.

## 2. I tell Kiki my language after signing in

On first login, I tap **Talk to Kiki**, or use the same questions as text:

1. “Which language are you comfortable learning in?” I choose **Odia**.
2. “How comfortable are you in Odia, from 1 to 10?” Example: **9/10**.
3. “How comfortable are you in English, from 1 to 10?” Example: **3/10**.

Once I select Odia, Kiki asks the remaining questions in Odia. Voice playback starts after a tap; microphone access is requested only if I answer aloud. I can type or tap without granting it. Kiki confirms my choices before taking me home.

These ratings express my confidence, not measured proficiency. They set an initial suggestion for support; they do not establish mastery. I can edit them in Profile.

**Language rule:** navigation and existing SVG asset labels remain English. Learning explanations, hints, and feedback default to Odia. English controls can have Odia spoken help or a short helper label. I can reveal equivalent English explanations and choose more English support; Kiki never switches my learning language without my choice.

## 3. My homepage gives me a clear starting action

First visit: **Add your subject** is the main action. I select **ECE**, my semester, and a subject such as **Basic Electronics**. College details can be optional unless required to identify my syllabus.

After setup, home shows my subjects, **Continue learning**, **Add today's material**, and **Start / Resume lab**. Navigation stays small: **Home · Learn · Labs · Library · Profile**. My chapter map opens within its subject rather than overwhelming an empty homepage.

A **Lab mode icon at the top right** of the signed-in interface opens the dedicated lab tracking page. It has a visible/accessibility label, **Lab mode**, and resumes my active experiment when one exists. Opening this page alone does not activate the pointer.

## 4. I upload what I need to learn

Inside Basic Electronics, I add a syllabus to organise the subject. I can also upload today's slides, PDFs, notes, document files, or clear photographs and say, by text or voice, “This was taught today.” A lab manual can be stored here or added when starting a lab.

I confirm the subject, chapter/topic, and optionally the class date. Kiki shows processing progress, then a short review: **Recognised chapter · Concepts found · Sources used**. I correct mismatched topics before creating the learning material.

The syllabus defines the subject structure; class material supplies today's content. I can start from a chapter or today's notes without uploading every subject first. Without a syllabus, Kiki labels the outline provisional. It identifies missing or unreadable pages and asks me to retry or select a topic; it never silently presents unrelated fallback content as my own notes.

Original files remain in Library. More uploads attach to the subject; they do not erase existing learning progress.

## 5. I see the chapter broken into concepts

For an illustrative diode/rectifier chapter, the circuit-style knowledge map might contain:

**PN junction → forward/reverse bias → V–I characteristic → half-wave rectifier → output waveform.**

The actual concepts come from my confirmed syllabus and material. Each node has a text status: **Not started · Learning · Revisit · Completed**. Wires show dependencies; tapping a pending node explains its prerequisite. A simple ordered list accompanies the map on small screens.

I can preview later concepts. Completing a prerequisite check unlocks the dependent learning step. I do not have to finish unrelated chapters before preparing for a particular lab.

## 6. I learn one concept through placards and notes

Opening a concept shows its learning goal and a small sequence of placards:

- **Definition:** one important definition or formula.
- **Concept:** the complete core idea, with a diagram, meaning, and a short example. A long idea is split into readable cards rather than shrunk to fit.
- **Application:** where this appears in a circuit or experiment.
- **Recap:** the few points to remember.

I read or listen in Odia. Every technical term preserves three distinct things: the English spelling, its pronunciation written in Odia script, and its Odia meaning. Example draft: **Current · କରେଣ୍ଟ · ବିଦ୍ୟୁତ୍ ପ୍ରବାହ**. Odia copy and transliterations require native-speaker review. Symbols, units, and equations stay consistent across languages.

Tapping a term opens pronunciation, meaning, and an example. **Explain again**, **Show an example**, and **Ask Kiki** help me without leaving the concept. I can save the placards as revision notes, and a source tag lets me open the slide/page they came from.

## 7. I check one concept before moving ahead

I choose **Practise this concept** and answer **four or five MCQs**, with Odia explanations and preserved English terms. Five questions is the recommended default for simple scoring.

After submission I see **4/5 correct — 80% on this attempt**, which answers were correct or incorrect, and a one-sentence explanation for each missed answer. Kiki avoids claiming that 80% correct means “80% complete understanding.”

**Confirmed concept progression rule:** below **60%**, revisit the missed ideas and retry equivalent questions. At **60% or above**, continue, with revision suggested for remaining gaps. With five questions, 3/5 meets this threshold; with four, 3/4 meets it. Scores occur in 20% or 25% increments, so 70% is not a possible score for these quiz sizes.

Taking the check is my choice, but the completion status of a prerequisite-dependent concept requires a passing check. I can pause anytime. If I miss an idea repeatedly, Kiki changes the explanation or checks its prerequisite instead of endlessly repeating the same quiz. Earlier attempts remain visible.

## 8. I take the chapter test

Once all required concept checks are complete, **Take chapter test** appears. Each chapter has **10 bilingual MCQs**, covering as many of its concepts as possible rather than concentrating on one topic. Where the chapter has ten or fewer concepts, include at least one question per concept; use any remaining questions for important applications or relationships. For chapters with more than ten concepts, prioritise core ideas and use questions spanning related concepts where appropriate. The question and options are available in English and Odia, without changing meaning or revealing answers.

I receive the total score and a compact concept breakdown. **The chapter passing threshold is 80%: at least 8/10 correct.** Below 80%, Kiki sends me to the relevant concepts and offers a new attempt after revision. At 80% or above, the chapter's theory check is complete. The report retains missed concepts for later revision. The concept threshold remains 60%; it does not replace this higher chapter threshold.

Bilingual MCQs provide practice reading academic English, but do not prove speaking or writing fluency. As an optional small addition, I can explain one idea to Kiki in English by voice or text and receive separate vocabulary feedback. That language feedback does not overwrite my theory score.

## 9. I tell Kiki which experiment I need to do

I click the **top-right Lab mode icon** to open the lab tracking page. The **Labs** navigation entry and **Start / Resume lab** actions lead to the same page. I choose **Start experiment** and either upload/snap the experiment page, select a lab manual already in Library, or type/say its title.

Kiki extracts and asks me to confirm **Subject · Experiment · Aim · Required equipment/software · Expected observations**. If the name or manual is ambiguous, I select the matching experiment before guidance begins. I choose **Software simulation** or **Hardware lab preparation**.

The preparation area links only the concepts required for my selected experiment, lists requirements, and asks me to predict the output. **Preparation is available anytime. Before guided execution, Kiki teaches any missing required concepts and I pass their concept checks at 60% or above.** Previously passed required concepts do not need to be retaught. I do not need to complete the full chapter or pass its 80% chapter test to begin this lab. A confirmed experiment can save as a lab session on my phone, even before I open the simulator.

The tracking page shows the selected experiment, required-concept readiness, software connection status, current step, completed/pending checkpoints, and saved observations. During execution, it tracks verified progress alongside my work in the simulator.

## 10. I continue the same software lab on my laptop

On my phone I tap **Continue on laptop → Copy session link**. I paste that link into the laptop browser, sign in to the same Kiki account, and see the saved experiment, language preference, prediction, and last completed step. QR transfer can be an additional convenience.

The link locates my session; it does not grant another person access to my private files. If it has expired, I can sign in and use **Resume lab**. Moving devices transfers control of the session to the laptop; the phone can show progress without simultaneously changing the step.

From the tracking page, I select **Open MATLAB/Simulink Online**. Kiki explains the separate MathWorks sign-in or license requirement and opens the selected browser tool. I select the experiment workspace and enable the supported guidance/observation connection with observable checkpoints.

**Hey Clickky 2.0 activation:** the experiment must be selected, its required concept checks passed, and the software/model workspace opened. Once the guidance connection confirms that workspace, the companion pointer activates inside the supported simulator surface. Before this, the tracking page shows **Select experiment**, **Learn required concepts**, **Open software**, or **Connecting**, as appropriate. A visible **Guidance active / Paused / Disconnected** status then shows whether Kiki can observe it. Simply opening Lab mode never starts pointing or tracking unrelated activity.

The first software experiment will be **medium difficulty**, giving Hey Clickky 2.0 enough steps to demonstrate its value: build a model, connect components, set parameters, run it, inspect the output, and diagnose a fault. The researched recommendation is **DSB-SC amplitude modulation and coherent demodulation**, built from basic Simulink blocks. I construct a transmitter/receiver, compare the original and recovered signals, and correct a receiver carrier mismatch. This is a proposed experiment, pending selection and a browser trial; see the [experiment recommendation](experiment-recommendation-simulink.md). The earlier diode/rectifier chapter remains a learning illustration, not the selected lab experiment.

**Laptop layout:** I keep the Kiki lab tracking page alongside the real Simulink workspace. The tracker shows progress, observations, and connection status; a compact guide shows the current step, its Odia explanation, its reason, and pause/resume controls. Through the supported integration, Hey Clickky 2.0 highlights targets in the actual software without covering them or replacing my cursor. An embedded software view is used only if supported; the flow also works with the tracker and simulator in separate browser windows.

The step loop is **Look here → understand why → perform the action myself → check the result → continue**. A ghost pointer can illustrate a click or drag, but never commits an action in my real experiment. Kiki does not wire the circuit, run the simulation, or correct a mistake for me.

Kiki checks observable actions/results at checkpoints such as component placement, connections, parameter settings, simulation completion, output inspection, and fault correction. If it cannot recognise the screen, it asks for clarification or a screenshot instead of pointing blindly. If monitoring disconnects, guidance pauses; reconnecting verifies the actual workspace before resuming. A manually confirmed step is labelled as such.

At the end, I compare prediction and output, save evidence and observations, and briefly explain why the result occurred. Progress returns to the linked chapter concepts.

**Important boundary:** Kiki's saved learning session and the simulator's circuit/model file are separate. The handoff stores a supported project link/file reference where available; it cannot recreate an unsaved external circuit from the session link alone.

## 11. I prepare for and record a hardware lab

On my phone I see an instructor-approved equipment list, a labelled circuit schematic, a breadboard placement view where available, component/pin identification, and an ordered connection checklist with reasons in Odia.

Before the college lab, I can rehearse connections in a diagram or supported simulation and predict measurements. In the lab, I assemble the real circuit myself, using the manual and instructor's directions. Kiki helps me read instrument settings, compare expected and recorded readings, identify possible errors, and prepare observations and viva answers.

I can upload a photo for visible connection feedback. Kiki states what it can and cannot see; a photograph cannot verify all electrical connections or certify a circuit safe to energise. Physical power-on checks belong to the instructor/lab procedure, especially for mains or higher-voltage equipment.

The record distinguishes **Prepared**, **Student-reported attempt**, and **Evidence reviewed**. Finishing a checklist alone does not count as demonstrated practical proficiency.

## 12. I return and know exactly where to continue

Kiki saves placard position, quiz attempts, confirmed chapter structure, language choices, and lab checkpoints. Home offers one clear continuation: **Resume concept**, **Revisit a gap**, or **Continue experiment**. Unsynced changes say **Waiting to sync**; device handoff uses the last server-saved checkpoint. I can end the lab, stop observation, and sign out on a shared laptop.

The four ring quarters use the updated, confirmed colour meanings:

| Colour | What I see | Evidence required |
|---|---|---|
| Green | Concept understanding | Concept/chapter answers |
| Red | Technical words | Vocabulary checks |
| Yellow | Academic English | Separate English tasks |
| Blue | Practical application | Lab actions and outputs |

An MCQ score does not fill all four quarters. Red means technical words, not an incorrect answer; correctness also has explicit text/icons. The circuit map and an optional route line reveal completed and pending work without adding a competing navigation system.

## Visual and device rules for the UI step

- White background; blue, red, yellow, and green used sparingly with readable text and labelled statuses.
- Google Sans for English UI; an appropriate Odia font fallback for regional text. This replaces the older design system's heading/body font choices.
- Reuse the existing Kiki dots, companion pointer, guide SVGs, term sheets, map nodes, and four-part rings. During UI implementation, align their colour usage with **green for concepts, red for technical words, yellow for academic English, and blue for practical application**. SVG labels remain English; Odia explanation lives alongside them.
- Phone: one column, readable placards, large tap targets, a list alternative to the map, and a collapsible lab guide. Laptop: larger map and software workspace beside guidance.
- The responsive web application works on both devices. Shared account, content, and session services should also support a future native mobile app while keeping the web app available.
- Core reading and navigation work without voice, animation, or colour perception. Voice is optional; loading, upload failure, and save state are always visible.

## Confirmed decisions and remaining preparation before UI implementation

| Decision | Confirmed choice | Remaining preparation |
|---|---|---|
| Colour meanings | Green: concepts; red: technical words; yellow: academic English; blue: practical application | Apply this mapping consistently to UI components and assets |
| Concept progression | 60% minimum; targeted revisit and retry below it | Prepare four- or five-question checks |
| Chapter progression | 80% minimum; targeted revisit and retry below it | Complete the theory check at 8/10 or above |
| Chapter test | 10 bilingual MCQs per chapter, covering most concepts | Map the question set to the chapter's concepts |
| Lab entry | Preparation anytime; guided execution after required concepts are taught and their checks passed at 60%; full chapter completion is not required | Map each experiment to its required concepts |
| First software lab | Browser-based MATLAB/Simulink Online; medium-difficulty experiment | Recommended candidate: DSB-SC modulation/coherent demodulation; confirm selection and trial it in the browser |
| Lab mode entry and activation | Top-right icon opens the tracking page; Hey Clickky 2.0 activates after experiment selection, concept readiness, software opening, and connection confirmation | Design inactive/connecting/active states and test activation on the real workspace |
| Guidance connection | Supported integration with observable checkpoints; tracking runs alongside execution | Choose the implementation mechanism and test it on the actual tool |
| Hardware support | Preparation, visible checks, observations, viva | Select one instructor-reviewed experiment and supported evidence checks |

Browser-based MATLAB/Simulink is the confirmed initial lab direction; desktop-app guidance can follow through a separate desktop integration. The supported connection must be validated on the selected tool. If the connection is unavailable, Kiki clearly labels companion instructions/screenshots as a fallback rather than claiming the live pointer is connected. A mock simulator is not treated as the student's actual software.

**Current tool check:** Digilent lists Multisim Live's end of life as **15 September 2026** and advises against new designs; it should not be the new browser-lab foundation. [Digilent notice](https://support.digilent.com/hc/en-us/articles/41178584173979-Multisim-Live-EOL-Letter). MATLAB/Simulink Online supports browser use and separate MathWorks sign-in; its suitability for the selected experiment and our guidance remains to be validated. [MathWorks overview](https://www.mathworks.com/products/simulink-online.html).

## References and next action

Sources used: the user's current clarification; [UX working document](../../../UX%20Working%20Doc%20%E2%80%94%20Bilingual%20STEM%20Learning%20%28AI%20Builder%20Cup%29.md); [product vision](../../AI_Builder_Cup_Product_Vision.docx); [design asset/component guidance](../../design-system/project/README.md). No earlier phase specifications were used.

BB8 and experience-design were applied as local reference guidance. Package validation passed; native plugin registration was not tested. The linked GitHub organisation currently exposes no public repositories, so the available local checkout supplied the references. [GitHub organisation](https://github.com/Kikiland-ai).

**Last completed action:** added the agreed lab prerequisite rule, top-right Lab mode entry, parallel tracking page, and Hey Clickky 2.0 activation sequence; researched and documented a medium-difficulty experiment recommendation.

**Exact next action:** confirm the recommended experiment and trial its model, tool access, and guidance checkpoints in MATLAB/Simulink Online; begin UI layouts with the agreed tracker and activation states.
