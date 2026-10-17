import { test, expect, type Page } from '@playwright/test';

// A real, selectable-text PDF: extraction must read these words, never a sample outline.
function pdf(text: string) {
  const stream = `BT /F1 12 Tf 40 100 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [3 0 R] >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let source = '%PDF-1.4\n'; const offsets: number[] = [];
  objects.forEach((object, i) => { offsets.push(source.length); source += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = source.length;
  source += `xref\n0 6\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return { name: 'class-notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from(source) };
}
async function setup(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.goto('/subjects/CRS-AC-ECE/material');
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Upload material', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('article', { name: 'Uploaded material: class-notes.pdf' })).toBeVisible();
}
test('PDF upload persists as a static card with no extraction UI or detail links', async ({ page }) => {
  await setup(page);
  await page.locator('#material-files').setInputFiles(pdf('The carrier stays at 2000 Hz.'));
  await expect(page.getByText('class-notes.pdf', { exact: true })).toBeVisible();
  await expect(page.getByText('The carrier stays at 2000 Hz.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Review extracted text', { exact: true })).toHaveCount(0);
  await save(page); await page.reload();
  const card = page.getByRole('article', { name: 'Uploaded material: class-notes.pdf' });
  await expect(card).toBeVisible();
  await expect(card.locator('a,button,[tabindex]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Read saved text|Open original|Open request/ })).toHaveCount(0);
  await page.goto('/library/old-source?view=text');
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.goto('/library');
  await expect(page.getByRole('button', { name: 'Open sample student' })).toBeVisible();
});
test('invalid documents preserve valid attachments; removing the last attachment prevents empty uploads', async ({ page }) => {
  await setup(page);
  await page.locator('#material-files').setInputFiles([pdf('DSB-SC notes'), { name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('bad header') }]);
  await expect(page.getByRole('alert')).toContainText('We couldn’t prepare this document');
  await expect(page.getByText('class-notes.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove class-notes.pdf', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload material' })).toBeDisabled();
});
for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
  test(`upload selection and static history have no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await setup(page);
    const name = 'ଓଡ଼ିଆ-class-notes-with-a-long-name-for-Analog-Modulation.pdf';
    await page.locator('#material-files').setInputFiles({ ...pdf('DSB-SC notes'), name });
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('button', { name: 'Upload material', exact: true }).click();
    await expect(page.getByRole('article', { name: `Uploaded material: ${name}` })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
