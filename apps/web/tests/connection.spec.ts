import { test, expect } from '@playwright/test';
test('development connection review explicitly identifies fixture identity and preserves private route guards',async({page})=>{
  await page.goto('/connection');await expect(page.getByRole('heading',{name:'Sample identity only',exact:true})).toBeVisible();
  await expect(page.getByText('This sample mode does not test Firebase or Python.',{exact:true})).toBeVisible();
  await page.goto('/home');await expect(page).toHaveURL(/\/auth\?/);
  await page.getByRole('button',{name:'Open sample student'}).click();await expect(page).toHaveURL(/\/onboarding/);
});
