/**
 * What each concept's canvas shows while a sentence is being narrated: control values to move to
 * and a one-line caption. Rules are matched in order against the sentence being spoken; the first
 * that fits wins. They key on the English technical terms and numbers, which the Odia narration
 * keeps in English, so one rule set serves both languages. C-AM-08 uses its own hand-placed beats
 * (narrationCues.ts) and is not listed here.
 *
 * Every value is a lesson example on the control's declared step (checked in canvasBeats.test.ts).
 */
export type CanvasBeat = { set: Record<string, number>; caption: string }
type Rule = CanvasBeat & { when: RegExp }

const RULES: Record<string, Rule[]> = {
  // Signal: amplitude (normalized), frequency (Hz), phase (degree)
  'C-AM-01': [
    { when: /Amplitude.*(does not|ନାହିଁ)|Changing amplitude/i, set: { amplitude: 2, frequency: 100, phase: 0 }, caption: 'More amplitude, same frequency' },
    { when: /axis|unit ଦେଖ/i, set: { amplitude: 1, frequency: 100, phase: 0 }, caption: 'Read the axis units before comparing waveforms' },
    { when: /Period|T=1\/f|0\.01|10 ms/, set: { amplitude: 1, frequency: 100, phase: 0 }, caption: 'One cycle of a 100 Hz signal lasts 10 ms' },
    { when: /2\*pi\*(f|100)|rad\/s/, set: { amplitude: 1, frequency: 100, phase: 0 }, caption: 'Software asks for 2π·f rad/s, not Hz' },
    { when: /Amplitude/i, set: { amplitude: 1.5, frequency: 100, phase: 0 }, caption: 'Amplitude is the peak size' },
    { when: /Phase/i, set: { amplitude: 1, frequency: 100, phase: 90 }, caption: 'Phase shifts the wave against the reference' },
    { when: /Frequency/i, set: { amplitude: 1, frequency: 200, phase: 0 }, caption: 'Frequency counts cycles per second' },
    { when: /sinusoid/i, set: { amplitude: 1, frequency: 100, phase: 0 }, caption: 'A sinusoid repeats smoothly over time' },
  ],
  // Flow: stage 0 message, 1 carrier, 2 modulator, 3 receiver
  'C-AM-02': [
    { when: /Demodulation|receiver|Receiver/, set: { stage: 3 }, caption: 'The receiver recovers the message' },
    { when: /100 Hz.*2000 Hz|chosen|ମୂଲ୍ୟ/, set: { stage: 0 }, caption: 'Lab values: a 100 Hz message, a 2000 Hz carrier' },
    { when: /Modulation|modulation/, set: { stage: 2 }, caption: 'Modulation changes a carrier property with the message' },
    { when: /Carrier|carrier/, set: { stage: 1 }, caption: 'The carrier is the reference oscillation' },
    { when: /Message|message|information|ତଥ୍ୟ|waveform/i, set: { stage: 0 }, caption: 'The message holds the information' },
  ],
  // Conventional AM: modulation index mu
  'C-AM-03': [
    { when: /mu>1|[Oo]vermodulation/, set: { mu: 1.5 }, caption: 'μ above 1: overmodulation distorts the envelope' },
    { when: /0<=mu<=1/, set: { mu: 1 }, caption: 'Up to μ = 1 the envelope stays above zero' },
    { when: /Emax|Emin/, set: { mu: 0.5 }, caption: 'μ = (Emax − Emin) / (Emax + Emin)' },
    { when: /DSB|suppressed/i, set: { mu: 0.5 }, caption: 'This envelope rule is for conventional AM, not DSB-SC' },
    { when: /Modulation index|\bmu\b/, set: { mu: 0.5 }, caption: 'μ is the modulation index' },
    { when: /Envelope|envelope|Conventional AM/, set: { mu: 0.5 }, caption: 'The envelope follows the message' },
  ],
  // DSB-SC: message frequency fm (Hz)
  'C-AM-04': [
    { when: /1900/, set: { fm: 100 }, caption: 'fm = 100 Hz puts the sidebands at 1900 and 2100 Hz' },
    { when: /Double-sideband|ପୂର୍ଣ୍ଣ ନାମ/i, set: { fm: 100 }, caption: 'Double sideband, suppressed carrier' },
    { when: /fc-fm|fc\+fm|[Ss]ideband/, set: { fm: 200 }, caption: 'Sidebands sit at fc − fm and fc + fm' },
    { when: /DC offset/, set: { fm: 100 }, caption: 'A DC offset in the message would bring the carrier line back' },
    { when: /line/, set: { fm: 100 }, caption: 'No separate carrier line in the ideal model' },
    { when: /offset/, set: { fm: 100 }, caption: 'Unlike conventional AM, no carrier offset is added' },
    { when: /[Ss]uppressed carrier|ଶୂନ୍ୟ/, set: { fm: 100 }, caption: 'Suppressed carrier does not mean zero output' },
    { when: /Product|s\(t\)|ଗୁଣ/, set: { fm: 100 }, caption: 'Message × carrier gives DSB-SC' },
    { when: /DSB-SC|Double-sideband/i, set: { fm: 100 }, caption: 'Double sideband, suppressed carrier' },
  ],
  // Spectrum family: 0 DSB-SC, 1 SSB, 2 VSB
  'C-AM-05': [
    { when: /lab|experiment|subsystem/, set: { family: 0 }, caption: 'Our lab uses DSB-SC' },
    { when: /between|ମଧ୍ୟରେ|vestige|ଛୋଟ ଅଂଶ|VSB/, set: { family: 2 }, caption: 'VSB: one sideband plus a vestige of the other' },
    { when: /SSB/, set: { family: 1 }, caption: 'SSB: one sideband, bandwidth B' },
    { when: /2B|DSB-SC/, set: { family: 0 }, caption: 'DSB-SC: both sidebands, bandwidth 2B' },
    { when: /[Ss]pectr/, set: { family: 0 }, caption: 'The variants differ in which components they send' },
  ],
  // Coherent receiver: stage 0 received, 1 multiply by local carrier, 2 lowpass, 3 gain 2
  'C-AM-06': [
    { when: /Gain|gain/, set: { stage: 3 }, caption: 'Gain 2 restores the ideal message amplitude' },
    { when: /Envelope|sign/, set: { stage: 3 }, caption: 'Coherent recovery keeps the message sign' },
    { when: /Practical filter|practical filter/, set: { stage: 2 }, caption: 'A practical filter can shift amplitude and phase a little' },
    { when: /Lowpass|lowpass|Filter|filter/, set: { stage: 2 }, caption: 'The lowpass filter keeps the message band' },
    { when: /local oscillator|Local carrier|Frequency ଓ Phase|frequency and phase/i, set: { stage: 1 }, caption: 'Multiply by a local carrier matched in frequency and phase' },
    { when: /cos\^2|m\(t\)\/2|product|Product/, set: { stage: 1 }, caption: 'The product holds m(t)/2 plus a term near 2fc' },
    { when: /DSB-SC/, set: { stage: 0 }, caption: 'The received DSB-SC signal' },
  ],
  // Lowpass filter: cutoff (Hz)
  'C-AM-07': [
    { when: /[Pp]hase lag|transient/, set: { cutoff: 500 }, caption: 'A startup transient, then a phase lag' },
    { when: /unwanted|perfectly|ହଟାଏ ନାହିଁ/, set: { cutoff: 1000 }, caption: 'Raise the cutoff and more of the 2fc ripple gets through' },
    { when: /2\*pi\*500|H\(s\)|wc/, set: { cutoff: 500 }, caption: 'ωc = 2π·500 rad/s in the transfer function' },
    { when: /500 Hz|Butterworth/, set: { cutoff: 500 }, caption: 'A second-order Butterworth lowpass at 500 Hz' },
    { when: /[Ss]tartup|steady-state|compare|ତୁଳନା/i, set: { cutoff: 500 }, caption: 'Compare the output after startup' },
    { when: /twice|ଦୁଇଗୁଣ|separation|Product detection/i, set: { cutoff: 300 }, caption: 'Keep the message, reject the components near 2fc' },
    { when: /[Ll]owpass|[Ff]ilter/, set: { cutoff: 500 }, caption: 'The lowpass filter separates the message' },
  ],
  // FM: frequency deviation df, message bandwidth B (Hz)
  'C-AM-09': [
    { when: /cycle spacing/, set: { df: 8000, B: 1000 }, caption: 'FM changes cycle spacing; DSB-SC changes amplitude' },
    { when: /Carson|2\*\(Delta f\+B\)/, set: { df: 5000, B: 1000 }, caption: 'Carson’s rule: about 2(Δf + B)' },
    { when: /approximation/, set: { df: 5000, B: 3000 }, caption: 'An approximation, not an exact limit' },
    { when: /beta|[Mm]odulation index/, set: { df: 5000, B: 1000 }, caption: 'β = Δf / fm' },
    { when: /[Dd]eviation|Delta f/, set: { df: 8000, B: 1000 }, caption: 'Frequency deviation Δf: the largest swing from the carrier' },
    { when: /Sideband|sideband/, set: { df: 5000, B: 1000 }, caption: 'FM has many sidebands' },
    { when: /constant amplitude|Amplitude ସ୍ଥିର|Amplitude/, set: { df: 5000, B: 1000 }, caption: 'Ideal FM keeps a constant amplitude' },
    { when: /DSB-SC|lab/, set: { df: 5000, B: 1000 }, caption: 'Not needed for the DSB-SC lab' },
    { when: /instantaneous|FM|Frequency modulation/, set: { df: 5000, B: 1000 }, caption: 'The carrier frequency follows the message' },
  ],
  // PM: phase sensitivity kp, constant message (0 or 1)
  'C-AM-10': [
    { when: /Constant message|constant message|fixed Phase shift|fixed phase shift/, set: { sensitivity: 1, constant: 1 }, caption: 'A constant message gives a fixed phase shift' },
    { when: /derivative/, set: { sensitivity: 1.5, constant: 0 }, caption: 'PM frequency deviation follows the message’s derivative' },
    { when: /rate of change|Instantaneous Frequency/, set: { sensitivity: 1, constant: 0 }, caption: 'Frequency = rate of change of phase ÷ 2π' },
    { when: /kp|sensitivity/, set: { sensitivity: 2, constant: 0 }, caption: 'kp sets how far the phase moves' },
    { when: /lab/, set: { sensitivity: 1, constant: 0 }, caption: 'Not needed for the DSB-SC lab' },
    { when: /Angle modulation|angle-modulation|FM\/PM|FM ଓ PM/, set: { sensitivity: 1, constant: 0 }, caption: 'FM and PM are both angle modulation' },
    { when: /Phase|PM/, set: { sensitivity: 1, constant: 0 }, caption: 'PM moves the carrier phase with the message' },
  ],
}

/** The beat for the sentence being spoken, or null when the concept has no canvas beats or none fit. */
export function canvasBeat(conceptId: string, sentence: string): CanvasBeat | null {
  const rule = RULES[conceptId]?.find((r) => r.when.test(sentence))
  return rule ? { set: rule.set, caption: rule.caption } : null
}

/** For checks: the concepts that have canvas beats. */
export const beatConcepts = Object.keys(RULES)
