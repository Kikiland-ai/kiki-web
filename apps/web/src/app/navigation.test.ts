import { describe, expect, it } from 'vitest';
import { safeReturn } from './navigation';
describe('sign-in return destinations', () => {
  it.each(['https://outside.example', '//outside.example', '/\\outside.example', '/auth?returnTo=/auth', '/onboarding', '/%2f%2foutside.example', '/unknown', '', undefined, null])('rejects unsafe or unsupported destination %s', value => { expect(safeReturn(value)).toBe('/home'); });
  it.each(['/home', '/subjects/CRS-AC-ECE', '/labs/session-123?handoff=abc', '/chapters/LP-ANALOG-MODULATION'])('preserves supported internal destination %s', value => { expect(safeReturn(value)).toBe(value); });
});
