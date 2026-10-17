import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page){
  await page.goto('/auth');await page.getByRole('button',{name:'Open sample student'}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Save and continue'}).click();
  await page.getByRole('button',{name:'Go to my home'}).click();
  await page.getByRole('link',{name:'Add your subject',exact:true}).click();await page.getByLabel('Semester',{exact:true}).selectOption('3');await page.getByRole('button',{name:'Add subject',exact:true}).click();
  await page.getByRole('link',{name:'Lab mode',exact:true}).click();await expect(page.getByRole('heading',{name:'Lab mode',exact:true})).toBeVisible();
}
async function start(page:Page){await page.getByRole('button',{name:'Start lab preparation',exact:true}).click();await expect(page.getByRole('heading',{name:'Read the experiment checkpoints',exact:true})).toBeVisible();}
async function save(page:Page){await page.getByRole('button',{name:'Save preparation',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Preparation saved'})).toBeVisible();}
test('preparation saves notes and place, copies owner-only link, resumes after sign-in and grants no evidence',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await setup(page);
  await expect(page.getByText('0 of 7 passed',{exact:true})).toBeVisible();await start(page);
  const url=page.url();await expect(page.getByText('Local preview: this address works on this computer. Phone/laptop continuation needs the app at a shared hosted address.',{exact:true})).toBeVisible();await expect(page.getByLabel('Session link',{exact:true})).toHaveValue(url);
  await expect(page.getByRole('link',{name:'Open MATLAB / Simulink Online',exact:true})).toHaveAttribute('href','https://matlab.mathworks.com/');
  await page.getByLabel('Your prediction',{exact:true}).fill('Expect sidebands at 1900 Hz and 2100 Hz.');
  await page.getByLabel('Saved Simulink model reference (optional)',{exact:true}).fill('My first DSB-SC model');
  await page.getByLabel('Observation 1 · Your notes',{exact:true}).fill('Baseline not run yet.');
  await page.getByRole('button',{name:'Read checkpoint 3',exact:true}).click();
  await expect(page.getByRole('button',{name:'Copy session link',exact:true})).toBeDisabled();await save(page);
  await page.getByRole('button',{name:'Copy session link',exact:true}).click();await expect(page.getByText('Session link copied',{exact:true})).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(url);
  await page.reload();await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Expect sidebands at 1900 Hz and 2100 Hz.');
  await expect(page.getByText('Checkpoint 3 of 12 · Reading position only',{exact:true})).toBeVisible();
  await expect(page.getByText('Manual preparation · Monitoring not connected',{exact:true})).toBeVisible();
  await expect(page.getByText('Kiki is guiding',{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Learn',exact:true}).click();await expect(page.getByRole('progressbar',{name:'Concept checks passed'})).toHaveAttribute('value','0');
  await page.getByRole('link',{name:'Home',exact:true}).click();await page.getByRole('link',{name:'Resume lab preparation',exact:true}).click();await expect(page).toHaveURL(url);
  await page.getByRole('link',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.goto(url);await expect(page.getByRole('button',{name:'Open sample student'})).toBeVisible();await page.getByRole('button',{name:'Open sample student'}).click();await expect(page.getByLabel('Observation 1 · Your notes',{exact:true})).toHaveValue('Baseline not run yet.');
});
test('unsaved notes block navigation and Save and leave preserves them',async({page})=>{
  await setup(page);await start(page);await page.getByLabel('Your prediction',{exact:true}).fill('Keep this draft.');await page.getByRole('link',{name:'Home',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Save your preparation before leaving?',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Keep this draft.');
  await page.getByRole('link',{name:'Home',exact:true}).click();await dialog.getByRole('button',{name:'Save and leave',exact:true}).click();await page.getByRole('link',{name:'Resume lab preparation',exact:true}).click();await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Keep this draft.');
});
test('failed save retains local text and Retry through Save recovers',async({page})=>{
  await setup(page);await start(page);await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('kiki:lab-preparation:fixture:')&&sessionStorage.getItem('lab-fail')==='yes')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};sessionStorage.setItem('lab-fail','yes');});
  await page.getByLabel('Your prediction',{exact:true}).fill('Keep after failed save.');await page.getByRole('button',{name:'Save preparation',exact:true}).click();await expect(page.getByRole('alert')).toContainText('not saved');await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Keep after failed save.');
  await page.evaluate(()=>sessionStorage.setItem('lab-fail','no'));await save(page);await page.reload();await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Keep after failed save.');
});
test('stale device save preserves local text while saved version is reviewed explicitly',async({page})=>{
  await setup(page);await start(page);await page.getByLabel('Your prediction',{exact:true}).fill('Local unsaved draft.');
  await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('kiki:lab-preparation:fixture:'))!;const record=JSON.parse(localStorage.getItem(key)!);record.prediction='Saved on another device.';record.revision++;localStorage.setItem(key,JSON.stringify(record));});
  await page.getByRole('button',{name:'Save preparation',exact:true}).click();await expect(page.getByRole('alert')).toContainText('another device');await page.getByRole('button',{name:'Review saved version',exact:true}).click();await expect(page.getByText('Saved on another device.',{exact:true})).toBeVisible();await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Local unsaved draft.');await page.getByRole('button',{name:'Use saved version',exact:true}).click();await expect(page.getByLabel('Your prediction',{exact:true})).toHaveValue('Saved on another device.');
});
for(const width of [320,390,768,1440])test(`lab preparation fits ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await setup(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await start(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(page.getByLabel('Your prediction',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Read checkpoint 12',exact:true}).click();await save(page);await expect(page.getByRole('button',{name:'Next checkpoint',exact:true})).toBeDisabled();});
