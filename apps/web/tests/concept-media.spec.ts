import { test, expect, type Page } from '@playwright/test';

// 17 Oct: C-AM-08 media from the published manifest (sample mode serves the same package).
async function openC08(page: Page, step = 0) {
  await page.goto('/auth'); await page.getByRole('button',{name:'Open sample student'}).click();
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Save and continue'}).click();
  await page.getByRole('button',{name:'Go to my home'}).click();
  await page.getByRole('link',{name:'Add your subject',exact:true}).click();
  await page.getByLabel('Semester',{exact:true}).selectOption('5'); await page.getByRole('button',{name:'Add subject',exact:true}).click();
  await page.getByRole('link',{name:'Learn',exact:true}).click();
  await page.getByRole('link',{name:/^Concept 8:/}).click();
  await expect(page.getByRole('heading',{level:1,name:'Carrier mismatch and debugging'})).toBeVisible();
  if (step) { await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(step).click(); await expect(page.getByText('Saving your place…',{exact:true})).toHaveCount(0); }
}
const scene=(page: Page)=>page.getByRole('region',{name:'Phase-recovery teaching scene'});

test('the phase scene explains C-AM-08 itself and exploring it saves nothing',async({page})=>{
  await openC08(page,1);
  const view=scene(page), reading=view.getByTestId('recovery-fraction'), trace=view.getByTestId('recovered-trace');
  await expect(view).toBeVisible();
  await expect(page.getByRole('region',{name:'DSB-SC teaching diagrams'})).toHaveCount(0);
  await expect(view.getByText('Change relative phase error; this is an ideal message-band prediction, not a simulator result.',{exact:true})).toBeVisible();
  await expect(reading).toHaveText('0.50'); await expect(trace).toHaveAttribute('data-fraction','0.50');
  const saved=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
  await view.getByRole('button',{name:/^90°/}).click();
  await expect(reading).toHaveText('0.00'); await expect(view.getByText('The ideal message component is suppressed.',{exact:true})).toBeVisible();
  await expect(view.getByRole('note',{name:'Finite-filter residual'})).toContainText('not modelled here');
  const slider=view.getByRole('slider',{name:/Relative phase error/});
  await slider.press('End'); await expect(reading).toHaveText('-1.00'); await expect(slider).toHaveAttribute('aria-valuetext','180 degrees, recovery -1.00');
  await view.getByRole('button',{name:'Reset to lesson example'}).click(); await expect(reading).toHaveText('0.50');
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)))).toBe(saved);
  // Same scene on Application; none on Definition or Recap
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(2).click(); await expect(scene(page)).toBeVisible();
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(3).click(); await expect(scene(page)).toHaveCount(0);
  await page.reload(); await expect(page.getByText('Step 4 of 4',{exact:true})).toBeVisible();
});

test('narration is a verified local copy, labelled, and freed when the lesson closes',async({page})=>{
  await openC08(page);
  await page.getByRole('button',{name:'Listen',exact:true}).click();
  const player=page.getByRole('region',{name:/^Listen: /});
  await expect(player.getByText('Sample audio · machine voice, not reviewed',{exact:true})).toBeVisible();
  await expect(player.getByText(/Words are not highlighted/)).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('audio')?.currentTime??0)).toBeGreaterThan(0.2);
  const src=await page.locator('audio').getAttribute('src');
  expect(src).toMatch(/^blob:/);
  expect(await page.evaluate(url=>fetch(url).then(r=>r.ok,()=>false),src!)).toBe(true);
  await page.getByRole('link',{name:'Analog Modulation'}).first().click();
  await expect(page.getByRole('heading',{name:'Analog Modulation',exact:true})).toBeVisible();
  expect(await page.evaluate(url=>fetch(url).then(r=>r.ok,()=>false),src!)).toBe(false);
});

test('a clip that cannot be fetched leaves the readable text and offers Retry',async({page})=>{
  await openC08(page);
  let block=true;
  await page.route(/\.wav(\?|$)/,route=>block?route.fulfill({status:503,body:''}):route.continue());
  await page.getByRole('button',{name:'Listen',exact:true}).click();
  const player=page.getByRole('region',{name:/^Listen: /});
  await expect(player.getByRole('alert')).toContainText("Couldn't load this narration.");
  await expect(page.locator('article p').first()).toBeVisible();
  block=false; await player.getByRole('button',{name:'Retry',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('audio')?.currentTime??0)).toBeGreaterThan(0.2);
});

test('C-AM-04 uses its common DSB canvas without duplicate legacy diagrams or a phase scene',async({page})=>{
  await openC08(page);
  await page.getByRole('link',{name:'Analog Modulation'}).first().click();
  await page.getByRole('link',{name:/^Concept 4:/}).click();
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(1).click();
  await expect(page.getByRole('region',{name:'CAM concept canvas'})).toBeVisible();
  await expect(page.getByRole('region',{name:'DSB-SC teaching diagrams'})).toHaveCount(0);
  await expect(scene(page)).toHaveCount(0);
  await page.getByRole('slider',{name:'Language mix',exact:true}).press('Home');
  await expect(page.getByRole('button',{name:'Listen',exact:true})).toBeVisible();
});

for(const width of [320,390,768,1280]) test(`phase scene fits with 48px controls at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900}); await openC08(page,1);
  const view=scene(page); await expect(view).toBeVisible();
  const box=(await view.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const small=await view.evaluate(el=>[...el.querySelectorAll('button, input')].map(c=>c.getBoundingClientRect()).filter(r=>r.width&&r.height<43.5).length);
  expect(small).toBe(0);
});
