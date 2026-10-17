import {test,expect,type Page} from '@playwright/test';
async function openDiagram(page:Page){
  await page.goto('/auth');await page.getByRole('button',{name:'Open sample student'}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Save and continue'}).click();
  await page.getByRole('button',{name:'Go to my home'}).click();
  await page.getByRole('link',{name:'Add your subject',exact:true}).click();
  await page.getByLabel('Semester',{exact:true}).selectOption('3');await page.getByRole('button',{name:'Add subject',exact:true}).click();
  await page.getByRole('link',{name:'Learn',exact:true}).click();
  await page.getByRole('link',{name:/^Concept 4:/}).click();
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(1).click();
  await expect(page.getByText('Saving your place…',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'DSB-SC teaching diagrams'})).toBeVisible();
}
test('frequency exploration moves the actual two stems and never creates a carrier line or score',async({page})=>{
  await openDiagram(page);const visual=page.getByRole('region',{name:'DSB-SC teaching diagrams'});
  const lower=visual.getByTestId('sideband-stems').locator('line').nth(0),upper=visual.getByTestId('sideband-stems').locator('line').nth(1);
  await expect(lower).toHaveAttribute('data-frequency-hz','1900');await expect(lower).toHaveAttribute('x1','197.6');
  await expect(upper).toHaveAttribute('data-frequency-hz','2100');await expect(upper).toHaveAttribute('x1','402.4');
  await expect(visual.getByTestId('carrier-reference')).toHaveAttribute('cy','212');
  await expect(visual.getByTestId('sideband-stems').locator('line')).toHaveCount(2);
  const state=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
  const slider=page.getByRole('slider',{name:/Message frequency/});await slider.press('End');
  await expect(lower).toHaveAttribute('data-frequency-hz','1800');await expect(lower).toHaveAttribute('x1','95.2');
  await expect(upper).toHaveAttribute('data-frequency-hz','2200');await expect(upper).toHaveAttribute('x1','504.8');
  await slider.press('Home');await expect(lower).toHaveAttribute('data-frequency-hz','1990');
  await visual.getByRole('button',{name:'Reset to lesson example'}).click();await expect(lower).toHaveAttribute('data-frequency-hz','1900');
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)))).toBe(state);
  await page.getByRole('link',{name:'Learn',exact:true}).click();await expect(page.getByRole('progressbar',{name:'Concept checks passed'})).toHaveAttribute('value','0');
  await page.getByRole('link',{name:/^Concept 4:/}).click();await expect(page.getByText('Step 2 of 4',{exact:true})).toBeVisible();
});
test('sideband term opens the existing Odia meaning beside its diagram and restores focus',async({page})=>{
  await openDiagram(page);const visual=page.getByRole('region',{name:'DSB-SC teaching diagrams'});
  const word=visual.getByRole('button',{name:'sideband',exact:true});await word.click();
  const sheet=page.getByRole('dialog',{name:'sideband',exact:true});await expect(sheet).toBeVisible();
  await expect(sheet.getByText('ସାଇଡ୍ବ୍ୟାଣ୍ଡ୍',{exact:true})).toBeVisible();
  await expect(sheet.getByText('Odia meaning',{exact:true})).toBeVisible();
  await expect(sheet.getByTestId('sideband-highlight').locator('rect')).toHaveCount(2);
  await page.getByRole('button',{name:'Close',exact:true}).click();await expect(word).toBeFocused();
  await expect(visual.getByTestId('sideband-highlight')).toBeVisible();
  await visual.getByRole('button',{name:'Clear diagram highlight'}).click();await expect(visual.getByTestId('sideband-highlight')).toHaveCount(0);
  await page.getByRole('region',{name:'Words in this lesson'}).getByRole('button',{name:'sideband',exact:true}).click();
  await page.getByRole('button',{name:'Close',exact:true}).click();await expect(visual.getByTestId('sideband-highlight')).toBeVisible();
});
for(const width of [320,390,768,1024,1440])test(`diagrams and linked word sheet fit ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await openDiagram(page);
  const visual=page.getByRole('region',{name:'DSB-SC teaching diagrams'});
  const bounds=await visual.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await visual.getByRole('button',{name:'sideband',exact:true}).click();
  const sheet=page.getByRole('dialog');await expect(sheet).toBeVisible();
  await expect.poll(async()=>{const box=await sheet.boundingBox();return box!.x;}).toBeGreaterThanOrEqual(0);
  await expect.poll(async()=>{const box=await sheet.boundingBox();return box!.x+box!.width;}).toBeLessThanOrEqual(width+1);
  expect(await sheet.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('slider',{name:'Language mix',exact:true}).press('End');
  await expect(visual.getByRole('img',{name:/^Ideal positive-frequency/})).toBeVisible();
});
