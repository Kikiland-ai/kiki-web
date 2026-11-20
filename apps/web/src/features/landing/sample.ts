/**
 * Real lesson content shown in the landing widgets, copied from the fixture build of the
 * Analog Modulation case (src/fixtures/learning-content.json, lab-practical.json). Odia is the
 * first language built; the page labels it as the example, never as the whole product.
 */
export const SAMPLE = {
  /** C-AM-08 recap placard: English source and its mixed Odia rendition. */
  recap: {
    en: 'Relative phase matters. Frequency mismatch can create beating. Diagnose one parameter at a time.',
    mixed: 'Relative Phase ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ। Frequency mismatch ରେ beating ହୋଇପାରେ। ଏକ ସମୟରେ ଗୋଟିଏ Parameter ଯାଞ୍ଚ କରନ୍ତୁ।',
    terms: ['Relative phase', 'Relative Phase', 'Frequency mismatch', 'beating', 'parameter', 'Parameter'],
  },
  /** C-AM-08 application placard, used for the dial's two ends. */
  application: {
    en: 'Change only the receiver phase by 90 degrees, inspect recovery, then restore the baseline and rerun.',
    mixed: 'କେବଳ Receiver phase କୁ 90 degree ବଦଳାନ୍ତୁ। Recovery ଦେଖି baseline Phase ଫେରାଇ ପୁଣି ଚଲାନ୍ତୁ।',
    terms: ['receiver phase', 'Receiver phase', 'recovery', 'Recovery', 'baseline', 'Phase', '90 degrees', '90 degree'],
  },
  /** C-AM-08 glossary terms. */
  glossary: [
    { term: 'phase error', sound: 'ଫେଜ୍ ଏରର୍', meaning: 'ଦୁଇ Carrier ମଧ୍ୟରେ ଆବଶ୍ୟକ ମେଳଠାରୁ Phase ତଫାତ।', definition: 'Relative phase mismatch between receiver and transmitter carriers.' },
    { term: 'frequency mismatch', sound: 'ଫ୍ରିକ୍ୱେନ୍ସି ମିସ୍ମ୍ୟାଚ୍', meaning: 'Receiver ଓ Transmitter carrier frequency ଅଲଗା ହେବା।', definition: 'A difference between receiver and transmitter carrier frequencies.' },
    { term: 'beating', sound: 'ବିଟିଙ୍ଗ୍', meaning: 'Frequency ତଫାତ ଯୋଗୁଁ Signal amplitude ର ସମୟଭିତ୍ତିକ ପରିବର୍ତ୍ତନ।', definition: 'A varying signal envelope caused by interaction of nearby frequencies.' },
  ],
  /** DSB-SC practical: the 12 checkpoints (English). The trial reached checkpoint 6. */
  checkpoints: [
    'Confirm the selected model workspace', 'Place the Message and Carrier sources', 'Set source frequencies, amplitudes and phases',
    'Connect the transmitter Product', 'Build the local carrier and receiver Product', 'Add the lowpass stage and Gain 2',
    'Connect and label the observation scopes', 'Set simulation duration and maximum step', 'Run the baseline model',
    'Inspect and record steady-state recovery', 'Try the 90-degree receiver phase fault', 'Restore, rerun, save and explain',
  ],
  trialReached: 6,
  /** Concept graph of the example chapter: parts (split on what each part is for), concepts and what each needs first. */
  chapter: 'Analog Modulation',
  parts: ['Signal basics', 'AM family', 'Receiver', 'FM and PM'],
  concepts: [
    { id: 1, name: 'Sinusoid basics', group: 0, pre: [], lab: true },
    { id: 2, name: 'Message and carrier', group: 0, pre: [1], lab: true },
    { id: 3, name: 'Conventional AM', group: 1, pre: [2], lab: true },
    { id: 4, name: 'DSB-SC', group: 1, pre: [3], lab: true },
    { id: 5, name: 'SSB and VSB', group: 1, pre: [4], lab: false },
    { id: 6, name: 'Coherent demodulation', group: 2, pre: [4], lab: true },
    { id: 7, name: 'Lowpass filtering', group: 2, pre: [6], lab: true },
    { id: 8, name: 'Carrier mismatch', group: 2, pre: [7], lab: true },
    { id: 9, name: 'Frequency modulation', group: 3, pre: [2], lab: false },
    { id: 10, name: 'FM vs PM', group: 3, pre: [9], lab: false },
  ],
} as const
