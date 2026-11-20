import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_NAME, modelName, modelNameError } from './model-name';

describe('lab model name', () => {
  it('defaults when blank and drops a typed .slx', () => {
    expect(modelName('')).toBe(DEFAULT_MODEL_NAME);
    expect(modelName('  ')).toBe(DEFAULT_MODEL_NAME);
    expect(modelName(' dsb_sc_aditya.SLX ')).toBe('dsb_sc_aditya');
  });
  it('accepts only names Simulink can save', () => {
    for (const ok of ['', 'dsb_sc', 'Lab2_DSB', 'a'.repeat(63)]) expect(modelNameError(ok)).toBe('');
    for (const bad of ['My first DSB-SC model', '2dsb', '_dsb', 'dsb-sc', 'a'.repeat(64)]) expect(modelNameError(bad)).not.toBe('');
  });
});
