import { test, expect, type Page } from '@playwright/test';
import bank from '../src/fixtures/assessment-bank.json' with { type: 'json' };
async function setup(page: Page) {
  await page.goto('/auth'); await page.getByRole('button',{name:'Open sample student'}).click();
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Save and continue'}).click();
  await page.getByRole('button',{name:'Go to my home'}).click();
  await page.getByRole('link',{name:'Add your subject',exact:true}).click(); await page.getByLabel('Semester',{exact:true}).selectOption('5');
  await page.getByRole('button',{name:'Add subject',exact:true}).click(); await page.goto('/practice');
  await expect(page.getByRole('heading',{name:'Check what you understand.'})).toBeVisible();
}
async function finish(page: Page, assessmentId: string, correctCount: number) {
  const assignment = bank.sets.find(s=>s.assessmentId===assessmentId)!;
  for(let i=0;i<assignment.questions.length;i++) {
    const question=assignment.questions[i], choice=i<correctCount?question.correctIndex:(question.correctIndex+1)%question.options.en.length;
    await page.getByRole('radio').nth(choice).check();
    await expect(page.getByText(`Draft saved · ${i+1}/${assignment.questions.length} answered`,{exact:true})).toBeVisible();
    if(i<assignment.questions.length-1) await page.getByRole('button',{name:'Next question',exact:true}).click();
  }
  await page.getByRole('button',{name:'Submit check',exact:true}).click();
  await expect(page.getByRole('heading',{name:`${correctCount}/${assignment.questions.length} correct — ${correctCount/assignment.questions.length*100}%`,exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Assessment result'})).toBeFocused();
}
test('drafts survive language change, refresh, confirmed leave and resume; incomplete checks cannot submit', async ({page})=>{
  await setup(page); await page.getByRole('link',{name:'Start concept check',exact:true}).first().click();
  await expect(page.getByText('QUESTION 1 OF 5',{exact:true})).toBeVisible();
  await page.getByRole('radio').nth(2).check(); await expect(page.getByText('Draft saved · 1/5 answered',{exact:true})).toBeVisible();
  await expect(page.getByRole('radio').nth(2)).toBeFocused();
  await page.getByRole('button',{name:'English',exact:true}).click(); await expect(page.getByRole('radio').nth(2)).toBeChecked();
  const runUrl=page.url(); await page.reload(); await expect(page.getByRole('radio').nth(2)).toBeChecked();
  await page.getByRole('button',{name:'Question 5, unanswered',exact:true}).click();
  await expect(page.locator('.question-card h2')).toBeFocused();
  await expect(page.getByRole('button',{name:'Submit check',exact:true})).toBeDisabled();
  await page.getByRole('link',{name:'Library',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Pause this check?'})).toBeVisible();
  await page.getByRole('button',{name:'Save and leave',exact:true}).click(); await expect(page.getByRole('heading',{name:'Your Library'})).toBeVisible();
  await page.goto('/practice'); await page.getByRole('link',{name:'Resume check',exact:true}).first().click(); await expect(page).toHaveURL(runUrl);
  await expect(page.getByText('QUESTION 5 OF 5',{exact:true})).toBeVisible();
});
test('concept failure/revision/retry passes at 3/5 and preserves both attempts', async ({page})=>{
  await setup(page); await page.getByRole('link',{name:'Start concept check',exact:true}).first().click(); await finish(page,'AS-AM-01',2);
  await expect(page.getByRole('heading',{name:'Revisit, then try again.',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Retry this check',exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'I reviewed the feedback or revisited my notes.'}).check(); await page.getByRole('link',{name:'Retry this check',exact:true}).click();
  await finish(page,'AS-AM-01',3); await expect(page.getByRole('heading',{name:'Concept check passed.',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'All concept checks',exact:true}).click(); await expect(page.getByText('Attempt 1 · 2/5 correct',{exact:true})).toBeVisible(); await expect(page.getByText('Attempt 2 · 3/5 correct',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Home',exact:true}).click(); await expect(page.getByText('1/10 checks passed',{exact:true})).toBeVisible(); await expect(page.getByText('Not assessed',{exact:true})).toHaveCount(3);
});
test('chapter prerequisites are explicit and chapter retry passes only at 8/10', async ({page})=>{
  await setup(page); await expect(page.getByRole('button',{name:'Chapter test locked'})).toBeDisabled();
  await page.getByRole('button',{name:'Load chapter-ready preview'}).click(); await page.getByRole('link',{name:'Start chapter test',exact:true}).click(); await finish(page,'AS-AM-CHAPTER',7);
  await expect(page.getByRole('heading',{name:'Revisit, then try again.',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'I reviewed the feedback or revisited my notes.'}).check(); await page.getByRole('link',{name:'Retry this check',exact:true}).click(); await finish(page,'AS-AM-CHAPTER',8);
  await expect(page.getByRole('heading',{name:'Chapter theory check passed.',exact:true})).toBeVisible();
});
for(const width of [320,360,390,430,768,1024,1280,1440]) {
  test(`quiz and result have no page overflow at ${width}px`, async ({page})=>{
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.setViewportSize({width,height:900}); await setup(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
    await page.getByRole('link',{name:'Start concept check',exact:true}).first().click(); await expect(page.getByText('QUESTION 1 OF 5',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
    await finish(page,'AS-AM-01',3); expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  });
}
