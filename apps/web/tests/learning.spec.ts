import { test, expect, type Page } from '@playwright/test';
import bank from '../src/fixtures/assessment-bank.json' with { type: 'json' };
async function setup(page: Page) {
  await page.goto('/auth'); await page.getByRole('button',{name:'Open sample student'}).click();
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Save and continue'}).click();
  await page.getByRole('button',{name:'Go to my home'}).click();
  await page.getByRole('link',{name:'Add your subject',exact:true}).click();
  await page.getByLabel('Semester',{exact:true}).selectOption('5'); await page.getByRole('button',{name:'Add subject',exact:true}).click();
  await page.getByRole('link',{name:'Learn',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Analog Modulation',exact:true})).toBeVisible();
}
async function result(page: Page, correctCount: number) {
  const questions=bank.sets.find(s=>s.assessmentId==='AS-AM-01')!.questions;
  for(let i=0;i<questions.length;i++) {
    const q=questions[i]; await page.getByRole('radio').nth(i<correctCount?q.correctIndex:(q.correctIndex+1)%q.options.en.length).check();
    await expect(page.getByText(`Draft saved · ${i+1}/5 answered`,{exact:true})).toBeVisible();
    if(i<4) await page.getByRole('button',{name:'Next question',exact:true}).click();
  }
  await page.getByRole('button',{name:'Submit check',exact:true}).click();
  await expect(page.getByRole('heading',{name:`${correctCount}/5 correct — ${correctCount*20}%`,exact:true})).toBeVisible();
}
async function openFirst(page: Page) {
  await page.getByRole('link',{name:/^Concept 1:/}).click();
  await expect(page.getByRole('heading',{name:'Amplitude, frequency and phase',exact:true,level:1})).toBeVisible();
}
async function lastPlacard(page: Page) {
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(3).click();
  await expect(page.getByText('Saving your place…',{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Check this concept',exact:true}).click();
}
async function expectDialPosition(page: Page, level: number) {
  const knob = page.getByRole('slider', { name: 'Language mix', exact: true });
  await expect(knob).toHaveAttribute('aria-valuenow', String(level));
  await expect.poll(async () => knob.evaluate((element, value) => {
    const track = element.parentElement!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const expected = track.left + track.height / 2 + (track.width - track.height) * (value - 1) / 4;
    return Math.abs(bounds.left + bounds.width / 2 - expected);
  }, level)).toBeLessThan(1);
  await expect.poll(async () => knob.evaluate((element, value) => {
    const matrix = new DOMMatrix(getComputedStyle(element, '::after').transform);
    const radians = (-120 + (value - 1) * 60) * Math.PI / 180;
    return Math.max(Math.abs(matrix.a - Math.cos(radians)), Math.abs(matrix.b - Math.sin(radians)));
  }, level)).toBeLessThan(0.01);
}
test('language knob and needle visibly follow keyboard, track clicks and mouse dragging', async ({ page }) => {
  await setup(page); await openFirst(page);
  const knob = page.getByRole('slider', { name: 'Language mix', exact: true });
  await knob.press('Home'); await expectDialPosition(page, 1);
  for (const level of [2, 3, 4, 5]) {
    await knob.press('ArrowRight'); await expectDialPosition(page, level);
  }
  await knob.press('ArrowLeft'); await expectDialPosition(page, 4);
  const track = knob.locator('..');
  await track.click({ position: { x: (await track.boundingBox())!.width / 2, y: 24 } });
  await expectDialPosition(page, 3);
  const bounds = (await track.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - bounds.height / 2, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up(); await expectDialPosition(page, 5);
  await knob.press('Home'); await expectDialPosition(page, 1);
});
test.describe('touch language dial', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('knob moves between Odia, mixed and English on a phone-sized touch viewport', async ({ page }) => {
    await setup(page); await openFirst(page);
    const knob = page.getByRole('slider', { name: 'Language mix', exact: true });
    const track = knob.locator('..');
    await track.scrollIntoViewIfNeeded();
    const bounds = (await track.boundingBox())!;
    for (const level of [5, 3, 1]) {
      await page.touchscreen.tap(bounds.x + bounds.height / 2 + (bounds.width - bounds.height) * (level - 1) / 4, bounds.y + bounds.height / 2);
      await expectDialPosition(page, level);
    }
  });
});
test('combined app shares lesson position, profile dial, quiz result and map; reading grants no pass',async({page})=>{
  await setup(page);
  await expect(page.getByText('0 of 10',{exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:/^This chapter: Concept Not assessed/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Chapter test locked'})).toBeDisabled();
  await openFirst(page);
  await page.getByRole('slider',{name:'Language mix',exact:true}).press('End');
  await expect(page.getByText('Saving your language preference…',{exact:true})).toHaveCount(0);
  const word=page.getByRole('region',{name:'Words in this lesson'}).getByRole('button').first(); const name=await word.innerText();
  await word.click(); await expect(page.getByRole('dialog',{name})).toBeVisible(); await expect(page.getByText('Odia meaning',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click(); await expect(word).toBeFocused();
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(1).click();
  await expect(page.getByText('Saving your place…',{exact:true})).toHaveCount(0);
  await page.reload(); await expect(page.getByText('Step 2 of 4',{exact:true})).toBeVisible();
  await expect(page.getByRole('slider',{name:'Language mix',exact:true})).toHaveAttribute('aria-valuenow','5');
  await page.getByRole('link',{name:'Learn',exact:true}).click();
  await expect(page.getByText('0 of 10',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/^Concept 1:/})).toContainText('Learning');
  await openFirst(page); await lastPlacard(page); await result(page,3);
  await page.getByRole('link',{name:'Chapter map',exact:true}).click();
  await expect(page.getByText('1 of 10',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/^Concept 1:/})).toContainText('Check passed');
  await expect(page.getByRole('link',{name:/^Concept 1:/})).toContainText('Latest check: 60%');
  await page.getByRole('link',{name:'Profile',exact:true}).click();
  await expect(page.getByLabel(/Language support/)).toHaveValue('5');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.goto('/concepts/C-AM-01'); await expect(page.getByRole('button',{name:'Open sample student'})).toBeVisible();
  await page.getByRole('button',{name:'Open sample student'}).click();
  await expect(page.getByText('Step 4 of 4',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Learn',exact:true}).click(); await expect(page.getByText('1 of 10',{exact:true})).toBeVisible();
});
test('failed concept and retry update the same map, preserving prior attempts',async({page})=>{
  await setup(page); await openFirst(page); await lastPlacard(page); await result(page,2);
  const url=page.url(); await page.getByRole('link',{name:'Chapter map',exact:true}).click();
  await expect(page.getByRole('link',{name:/^Concept 1:/})).toContainText('Revisit');
  await page.goto(url); await page.getByRole('checkbox',{name:'I reviewed the feedback or revisited my notes.'}).check();
  await page.getByRole('link',{name:'Retry this check',exact:true}).click(); await result(page,3);
  await page.getByRole('link',{name:'Chapter map',exact:true}).click(); await expect(page.getByText('1 of 10',{exact:true})).toBeVisible();
  await page.goto('/practice'); await expect(page.getByText('Attempt 1 · 2/5 correct',{exact:true})).toBeVisible(); await expect(page.getByText('Attempt 2 · 3/5 correct',{exact:true})).toBeVisible();
});
async function failWrites(page: Page, prefix: string) {
  await page.addInitScript(prefix=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value) { if(key.startsWith(prefix) && sessionStorage.getItem('learning-test-fail-write')==='yes') throw new DOMException('Storage full','QuotaExceededError'); return original.call(this,key,value); };
  },prefix);
}
test('failed lesson-position saves are visible and recover on retry',async({page})=>{
  await failWrites(page,'kiki:learning-positions:fixture:'); await setup(page); await openFirst(page);
  await page.evaluate(()=>sessionStorage.setItem('learning-test-fail-write','yes'));
  await page.getByRole('navigation',{name:'Lesson steps'}).getByRole('button').nth(1).click();
  await expect(page.getByRole('alert')).toContainText('Your place was not saved.');
  await page.evaluate(()=>sessionStorage.setItem('learning-test-fail-write','no'));
  await page.getByRole('button',{name:'Retry saving place',exact:true}).click(); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.getByText('Step 2 of 4',{exact:true})).toBeVisible();
});
test('failed language saves retain the readable selection and offer retry',async({page})=>{
  await failWrites(page,'kiki:fixture:profile:'); await setup(page); await openFirst(page);
  await page.evaluate(()=>sessionStorage.setItem('learning-test-fail-write','yes'));
  await page.getByRole('slider',{name:'Language mix',exact:true}).press('End');
  await expect(page.getByRole('alert')).toContainText('Language preference not saved:');
  await page.evaluate(()=>sessionStorage.setItem('learning-test-fail-write','no'));
  await page.getByRole('button',{name:'Retry language preference',exact:true}).click(); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('slider',{name:'Language mix',exact:true})).toHaveAttribute('aria-valuenow','5');
});
for(const width of [320,360,390,430,768,1024,1280,1440]) {
  test(`combined map, lesson and term sheet fit ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900}); await setup(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await openFirst(page); expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.getByRole('region',{name:'Words in this lesson'}).getByRole('button').first().click();
    const dialog=page.getByRole('dialog'); await expect(dialog).toBeVisible();
    await expect.poll(async()=>{const box=await dialog.boundingBox();return box!.x;}).toBeGreaterThanOrEqual(0);
    await expect.poll(async()=>{const box=await dialog.boundingBox();return box!.x+box!.width;}).toBeLessThanOrEqual(width+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  });
}

test('later concepts can be previewed with their prerequisite explanation',async({page})=>{
  await setup(page); await page.getByRole('link',{name:/^Concept 8:/}).click();
  const prerequisites=page.getByRole('complementary',{name:'Prerequisite concepts'});
  await expect(prerequisites).toContainText('You can preview this lesson.');
  await expect(prerequisites.getByRole('link',{name:'Lowpass filtering and waveform comparison',exact:true})).toHaveAttribute('href','/concepts/C-AM-07');
});
