/**
 * The demo experiment. The contract has no practical-details endpoint yet,
 * so its display copy lives here; ids match the content (contract §2).
 */
export const DSB_SC = {
  practicalId: 'PR-AM-DSB',
  planId: 'LP-ANALOG-MODULATION',
  title: 'DSB-SC modulation and coherent demodulation',
  aim: 'Build a DSB-SC transmitter and coherent receiver, compare the signals, then find and fix a 90° receiver phase fault.',
  software: 'MATLAB/Simulink Online',
  softwareUrl: 'https://matlab.mathworks.com/',
  steps: 12,
  /** From the content's practical.observationPrompts. */
  observationPrompts: [
    {
      en: 'Record baseline message and carrier frequencies and compare recovered amplitude after startup.',
      or: 'Baseline Message ଓ Carrier frequency ଲେଖନ୍ତୁ ଏବଂ Startup ପରେ Recovered amplitude ତୁଳନା କରନ୍ତୁ।',
    },
    {
      en: 'Record the relative receiver phase, recovery change, and why the correction works.',
      or: 'Relative Receiver phase, Recovery ପରିବର୍ତ୍ତନ ଓ Correction କାହିଁକି କାମ କରେ ଲେଖନ୍ତୁ।',
    },
  ],
} as const
