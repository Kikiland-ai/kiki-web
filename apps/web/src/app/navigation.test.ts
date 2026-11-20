import { describe, expect, it } from 'vitest';
import { safeReturn } from './navigation';
describe('sign-in return destinations', () => {
  it('returns to the saved physical experiment after sign-in',()=>{const path='/labs/physical/'+'a'.repeat(32);expect(safeReturn('/labs/physical')).toBe('/labs/physical');expect(safeReturn(path)).toBe(path);expect(safeReturn('/labs/physical/not-a-session')).toBe('/home');});
  it.each(['https://outside.example', '//outside.example', '/\\outside.example', '/auth?returnTo=/auth', '/onboarding', '/%2f%2foutside.example', '/unknown', '/concepts/C-AM-03/talk/../x', '/concepts/C-AM-03/talk/', '/concepts/C-AM-03/other/q', '', undefined, null])('rejects unsafe or unsupported destination %s', value => { expect(safeReturn(value)).toBe('/home'); });
  it.each(['/home', '/subjects/CRS-AC-ECE', '/labs/session-123?handoff=abc', '/chapters/LP-ANALOG-MODULATION', '/concepts/C-AM-03/talk/ece-am-envelope-design'])('preserves supported internal destination %s', value => { expect(safeReturn(value)).toBe(value); });
});
