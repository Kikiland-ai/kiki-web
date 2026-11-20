import { expect, it, vi } from 'vitest';
import type { TutorApi } from '../../contracts/tutor';
import { tutorAvailable } from './available';

const api = (health: () => Promise<{ enabled: boolean }>) => ({ health: vi.fn(health) }) as unknown as TutorApi & { health: ReturnType<typeof vi.fn> };

it('offers tutor mode only when the API says it is enabled', async () => {
  expect(await tutorAvailable(undefined)).toBe(false);
  expect(await tutorAvailable(api(async () => ({ enabled: true })))).toBe(true);
  expect(await tutorAvailable(api(async () => ({ enabled: false })))).toBe(false);   // shipped off: no entry points
  expect(await tutorAvailable(api(async () => { throw new Error('503'); }))).toBe(false);
});

it('asks the API once per client', async () => {
  const a = api(async () => ({ enabled: true }));
  await Promise.all([tutorAvailable(a), tutorAvailable(a), tutorAvailable(a)]);
  expect(a.health).toHaveBeenCalledTimes(1);
});
