import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PhysicalLabNarrationManifestSchema } from '../../src/contracts/lab-narration';
import { observeNarration } from '../narration-evidence';

type Fixture = typeof import('../../src/features/labs/__fixtures__/physical/dsb-sc.json');
const fixture = JSON.parse(readFileSync(new URL('../../src/features/labs/__fixtures__/physical/dsb-sc.json', import.meta.url), 'utf8')) as Fixture;

test('plays nine real recordings once per saved physical step and stops on completion', async ({ page }) => {
  await page.goto('/tests/physical-lab/index.html');
  await page.getByRole('button', { name: 'Start experiment', exact: true }).click();
  const guide = page.getByRole('complementary', { name: 'KiKi experiment guide' });
  await expect(guide.getByRole('heading')).toHaveText('Connect Message output to Message input.');
  const view = await observeNarration(page);
  const response = page.waitForResponse(r => r.url().endsWith('/narration'));
  const responses: string[] = [];
  page.on('response', r => {
    if (r.ok() && r.url().includes('/narration/') && r.url().includes('/assets/')) {
      responses.push(r.url().split('/').at(-1)!);
    }
  });
  const marker = (id: string) => page.getByRole('button', {
    name: `${fixture.pack.parts.find(part => part.id === id)!.label} on instrument`, exact: true,
  });
  await guide.getByRole('button', { name: 'Enable Odia–English narration' }).click();
  const manifest = PhysicalLabNarrationManifestSchema.parse(await (await response).json());
  expect(Object.keys(manifest.clips)).toHaveLength(9);
  await expect.poll(async () => (await view()).time).toBeGreaterThan(0);
  expect((await view()).peak).toBeGreaterThan(0.02);
  await marker('source.carrier').press('Enter');
  await marker('modulator.message').press('Enter');
  await expect(guide.getByText('That action needs another try.', { exact: false })).toBeVisible();
  expect((await view()).starts).toHaveLength(1);

  await guide.getByRole('button', { name: 'Replay narration' }).click();
  await expect.poll(async () => (await view()).starts.length).toBe(2);
  const first = (await view()).starts[0];
  expect((await view()).starts[1]).toBe(first);
  await guide.getByRole('button', { name: 'Mute narration', exact: true }).click();
  await expect.poll(async () => (await view()).playing).toBe(false);
  await guide.getByRole('button', { name: 'Unmute narration', exact: true }).click();
  await expect.poll(async () => (await view()).starts.length).toBe(3);

  for (const [index, action] of fixture.actions.entries()) {
    if (action.kind === 'connect') {
      await marker(action.target).press('Enter');
      await marker(action.other!).press('Enter');
    } else if (action.kind === 'set') {
      await guide.getByLabel('Carrier null adjustment').fill(String(action.value));
      await guide.getByRole('button', { name: 'Apply setting' }).click();
    } else {
      await guide.getByLabel(`Observed value (${action.unit})`).fill(String(action.value));
      await guide.getByRole('button', { name: 'Record reading' }).click();
    }
    if (index < fixture.actions.length - 1) {
      const step = fixture.states[index+1].activity.step!;
      await expect(guide.getByRole('heading')).toHaveText(step.instruction.en);
      await expect.poll(async () => (await view()).starts.length).toBe(index + 4);
      expect(responses.at(-1)).toBe(manifest.clips[step.id].assetId);
    }
  }
  await expect(guide.getByRole('heading')).toHaveText('Your message has been recovered');
  await expect.poll(async () => (await view()).playing).toBe(false);
  expect([...new Set(responses)]).toEqual(Object.values(manifest.clips).map(clip => clip.assetId));
  await expect(guide.getByRole('button', { name: 'Replay narration' })).toHaveCount(0);
});
