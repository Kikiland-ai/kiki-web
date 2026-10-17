Kiki's guide artwork: Kiki as a companion cursor that lives beside the student's own cursor or finger, flies to the thing that matters on their screen, and shows them the route one step at a time. Use these for slides, the pitch deck, specs and anywhere the live `KikiPointer` can't run.

**The guide grammar** (every scene follows it):

- **Step now:** a halo on the target and a filled number badge.
- **Steps ahead:** ghost (dashed) number badges joined by a dashed route that flows towards them. The student sees steps 2 and 3 while doing step 1.
- **Done:** the route behind turns solid and the badge becomes a tick.
- **Where Kiki came from:** the four dots trail behind the pointer along its flight path. A faint dotted line shows a longer flight, for example from beside the student's cursor.
- **Kiki's eyes look at the next thing,** not at the student, so the gaze itself points the way.
- **Kiki never covers the target.** It parks at the edge of the halo, and its marks run beside a wire or a line of text (a rail), never on top of the student's diagram.
- **Colour is the skill:** green for an idea, red for a technical term, yellow for exam English, blue in the lab. Red never means wrong.

**Files** (each scene is 320 × 220 and uses the same worked example: R3 in series, then R1 and R2 in parallel):

| File | Move | Use it when Kiki… |
| --- | --- | --- |
| `kiki-guide-look.svg` | Look here | flies from beside the student's cursor to the first thing to look at |
| `kiki-guide-path-ahead.svg` | Path ahead | has started step 1 and shows steps 2 and 3 waiting on the route |
| `kiki-guide-trace.svg` | Trace | rides along a wire or path (current, flow, a sequence), solid behind and dashed ahead |
| `kiki-guide-connect.svg` | Connect | links two parts and names what they share |
| `kiki-guide-your-turn.svg` | Your turn | hands the next step to the student and waits beside the target |
| `kiki-guide-redirect.svg` | Redirect | draws the way from where the student tapped to where they should look ("Close. Look here instead") |
| `kiki-guide-show-me.svg` | Show me | demonstrates a drag in the lab, from the parts tray to the slot |
| `kiki-guide-ask.svg` | Ask | asks a question and waits between the answers |
| `kiki-guide-done.svg` | Done | marks the route complete: every step ticked, a small hop |
| `kiki-guide-words.svg` | Words | uses the same grammar on text: sweeps the term, shows the next phrase ahead |
| `kiki-guide-thinking.svg` | Thinking | is reading the student's screen (Gemini at work) |
| `kiki-guide-listening.svg` | Listening | is recording the student's voice |
| `kiki-guide-unsure.svg` | Unsure | is not sure which part the student means, so it offers the candidates instead of guessing |
| `kiki-guide-storyboard.svg` | Storyboard | the series-or-parallel question guided in four moves: look, path ahead, connect, your turn |
| `kiki-pointer.svg` | Pointer | the bare pointer with its trail, for avatars and small marks (160 × 160) |
| `kiki-dots.svg` | Dots | the four-dot form, for the app icon, the top bar and loading states |
| `kiki-sheet.svg` | Sheet | every move on one labelled sheet, for reviews |

Scenes animate gently where a browser shows them through an `<img>` (the halo pulses, the route ahead flows, the wait ring turns). A static copy shows the first frame, which is complete on its own.

Inks: the pointer body is #1f1f1f with a #ffffff outline, white eyes with dark pupils, in every theme. The dots are always blue #4285f4, red #ea4335, yellow #fbbc05 and green #34a853, in that order: they are Kiki's identity, not the skill colours. Source: `design-system/tools/build-kiki.js` regenerates every file.
