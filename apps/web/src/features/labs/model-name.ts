/** The Simulink model name a student saves for this lab. Mirrors the API's `model_name()` check. */
export const DEFAULT_MODEL_NAME = 'dsb_sc';
export const MODEL_FOLDER = 'MATLAB Drive';
const VALID = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;

/** Trims, drops a typed `.slx`, and falls back to the default when blank. */
export function modelName(projectRef: string): string {
  const name = projectRef.trim().replace(/\.slx$/i, '');
  return name || DEFAULT_MODEL_NAME;
}

/** Simulink only saves models under valid MATLAB names. */
export function modelNameError(projectRef: string): string {
  return VALID.test(modelName(projectRef)) ? '' : 'Simulink can’t save this name. Start with a letter and use only letters, numbers and _.';
}
