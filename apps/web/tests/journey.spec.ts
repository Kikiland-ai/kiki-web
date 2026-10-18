import { test, expect, type Page } from '@playwright/test';
async function sample(page: Page, path = '/auth') {
  await page.goto(path);
  await page.getByRole('button', { name: 'Open sample student' }).click();
  await expect(page.getByRole('heading', { name: 'What language feels comfortable?' })).toBeVisible();
}
async function onboarding(page: Page) {
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('slider', { name: 'Odia confidence' }).fill('9');
  await page.getByRole('slider', { name: 'English confidence' }).fill('3');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('9/10', { exact: true })).toBeVisible();
  await expect(page.getByText('3/10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go to my home' }).click();
}
test('account-first onboarding resumes, subject saves, profile updates and sign-out protects records', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'How comfortable do you feel?' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'How comfortable do you feel?' })).toBeVisible();
  await page.getByRole('slider', { name: 'Odia confidence' }).fill('9');
  await page.getByRole('slider', { name: 'English confidence' }).fill('3');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('slider', { name: 'Your starting support' }).fill('3');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Aditya.' })).toBeVisible();
  await expect(page.getByText('Not assessed', { exact: true })).toHaveCount(4);
  await page.getByRole('link', { name: 'Add your subject' }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.getByRole('link', { name: 'Open subject' }).click();
  await expect(page.getByRole('heading', { name: 'Analog Communication', level: 1, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('slider', { name: 'English confidence' }).fill('4');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('slider', { name: 'English confidence' })).toHaveValue('4');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open sample student' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Make room for how you learn.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open sample student' }).click();
  await expect(page.getByRole('slider', { name: 'English confidence' })).toHaveValue('4');
});
test('protected lab deep link survives sign-in and onboarding; no pointer claim', async ({ page }) => {
  await sample(page, '/labs/session-123?handoff=abc');
  await onboarding(page);
  await expect(page).toHaveURL(/\/labs\/session-123\?handoff=abc$/);
  await expect(page.getByRole('heading', { name: 'Your lab preparation couldn’t open.', exact: true })).toBeVisible();
  await expect(page.getByText('Kiki is guiding', { exact: true })).toHaveCount(0);
});
test('failed fixture save stays on the current step and offers retry', async ({ page }) => {
  await sample(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What language feels comfortable?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and continue' })).toBeEnabled();
});
test('an already signed-in student with incomplete onboarding keeps a new destination', async ({ page }) => {
  await sample(page);
  await page.goto('/labs/session-new');
  await expect(page.getByRole('heading', { name: 'What language feels comfortable?' })).toBeVisible();
  await onboarding(page);
  await expect(page).toHaveURL(/\/labs\/session-new$/);
});
test('rotation and a reduced layout viewport retain preferences and reachable actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('slider', { name: 'Odia confidence' }).fill('9');
  await page.getByRole('slider', { name: 'English confidence' }).fill('3');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('slider', { name: 'Odia confidence' })).toHaveValue('9');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  // Emulate the available layout width/height at 200% browser zoom.
  // CSS body zoom does not update media queries and is not equivalent to browser zoom.
  // A physical browser/OS text-zoom check remains a release gate.
  await page.setViewportSize({ width: 422, height: 195 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'English confidence' })).toHaveValue('3');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences saved')).toBeVisible();
});
test('keyboard and reduced-motion logo remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const animation = await page.locator('.wordmark-animate .wordmark-roll').evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
  await page.getByRole('link', { name: 'Get started' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
  await page.getByRole('button', { name: 'Open sample student' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  const slider = page.getByRole('slider', { name: 'Odia confidence' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('10');
});
for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
  test(`journey is usable without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(await overflow()).toBe(false);
    await sample(page);
    expect(await overflow()).toBe(false);
    await onboarding(page);
    await expect(page.getByRole('heading', { name: 'Hello, Aditya.' })).toBeVisible();
    expect(await overflow()).toBe(false);
    await page.getByRole('link', { name: 'Lab mode', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lab mode', exact: true })).toBeVisible();
    expect(await overflow()).toBe(false);
  });
}
