import {test,expect} from '@playwright/test';

test('browser language, remembered choice, localized metadata and mobile navigation',async({browser})=>{
 const context=await browser.newContext({locale:'ro-RO',viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto('/');await expect(page).toHaveURL(/\/ro$/);
 await expect(page.locator('html')).toHaveAttribute('lang','ro');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await expect(page).toHaveURL(/\/en$/);await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.goto('/');await expect(page).toHaveURL(/\/en$/);
 await expect(page.locator('link[rel="alternate"][hreflang="ro"]')).toHaveAttribute('href','https://www.thedivinework.com/ro');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:/menu/i}).click();
 await expect(page.getByRole('navigation').getByRole('link',{name:/library/i})).toBeVisible();
 await context.close();
});

test('78-card library filters and card guides have both language versions',async({page})=>{
 await page.goto('/en/library');await expect(page.locator('.dw-card-tile')).toHaveCount(78);
 await page.getByRole('button',{name:'Major Arcana',exact:true}).click();await expect(page.locator('.dw-card-tile')).toHaveCount(22);
 await page.locator('.dw-card-tile').first().click();await expect(page.getByRole('heading',{name:'The Fool',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:/reversed/i})).toBeVisible();
 await page.getByRole('button',{name:'RO',exact:true}).click();await expect(page.getByRole('heading',{name:'Nebunul',exact:true})).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('lang','ro');
});

for(const width of [390,768,1440])test(`public pages fit a ${width}px viewport`,async({page})=>{
 await page.setViewportSize({width,height:900});
 for(const path of ['/ro','/en/library','/ro/library/the-fool','/en/draw','/ro/account','/en/journal','/ro/booking','/en/membership']){
  await page.goto(path);await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
 }
});

test('unconfigured customer accounts fail closed and stay separate from Studio',async({page,request})=>{
 await page.goto('/en/journal');await expect(page.getByRole('link',{name:'Sign in or create a free account'})).toBeVisible();
 expect((await request.get('/api/journal')).status()).toBe(503);
 expect((await request.post('/api/account/auth',{headers:{Origin:'https://evil.example'},data:{action:'signin'}})).status()).toBe(403);
 expect((await request.get('/studio')).status()).toBe(401);
});

test('journal interface supports CRUD, search and personal study progress',async({page})=>{
 // Only the interface is mocked here. Real two-user RLS is checked against migration 014 in the SQL integration tests.
 let entries:any[]=[],notes:any[]=[],signedIn=true;
 await page.route('**/api/account/session',route=>route.fulfill({json:{configured:true,user:signedIn?{id:'fixture-owner',email:'journal@example.com'}:null,profile:{locale:'en'}}}));
 await page.route('**/api/journal**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()==='GET'){
   if(url.searchParams.get('view')==='notes')return route.fulfill({json:{notes}});
   const query=url.searchParams.get('q')??'',filtered=entries.filter(e=>e.title.includes(query));
   return route.fulfill({json:{entries:filtered,count:filtered.length}});
  }
  const data=request.postDataJSON();
  if(data.action==='save'){const entry={...data,id:data.id??'entry-1'};entries=[...entries.filter(e=>e.id!==entry.id),entry];}
  if(data.action==='delete')entries=entries.filter(e=>e.id!==data.id);
  if(data.action==='note')notes=[data];
  return route.fulfill({json:{saved:true}});
 });
 await page.goto('/en/journal');await page.getByLabel('Entry title').fill('A hopeful morning');
 await page.getByLabel('My interpretation',{exact:true}).fill('I can take a small first step.');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.dw-entry')).toContainText('A hopeful morning');
 await page.locator('.dw-entry').getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Entry title').fill('A calmer morning');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.dw-entry')).toContainText('A calmer morning');
 await page.getByLabel('Search your journal').fill('missing');await expect(page.locator('.dw-entry')).toHaveCount(0);
 await page.getByLabel('Search your journal').fill('');await expect(page.locator('.dw-entry')).toHaveCount(1);
 page.once('dialog',dialog=>dialog.accept());await page.locator('.dw-entry').getByRole('button',{name:'Delete',exact:true}).click();await expect(page.locator('.dw-entry')).toHaveCount(0);
 await page.getByRole('button',{name:'My Tarot Book',exact:true}).click();await page.getByLabel('My personal interpretation').fill('A beginning worth noticing.');await page.getByLabel('I have studied this card').check();await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'My Progress',exact:true}).click();await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
 await page.reload();await page.getByRole('button',{name:'My Tarot Book',exact:true}).click();await expect(page.getByLabel('My personal interpretation')).toHaveValue('A beginning worth noticing.');await expect(page.getByLabel('I have studied this card')).toBeChecked();
 signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('link',{name:'Sign in or create a free account'})).toBeVisible();await expect(page.locator('body')).not.toContainText('A beginning worth noticing.');
});

test('card notes stay bound to the selected card and clear when the session ends',async({page})=>{
 let signedIn=true;
 await page.route('**/api/account/session',route=>route.fulfill({json:{configured:true,user:signedIn?{id:'fixture-owner'}:null}}));
 await page.route('**/api/journal**',route=>route.fulfill({json:{notes:[{card_id:'thefool',notes:'Private thoughts on a beginning.',studied:true}]}}));
 await page.goto('/en/library/the-fool');await expect(page.getByLabel('My personal notes · private')).toHaveValue('Private thoughts on a beginning.');
 await page.goto('/en/library/the-star');await expect(page.getByLabel('My personal notes · private')).toHaveValue('');await expect(page.getByLabel('I have studied this card')).not.toBeChecked();
 signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('link',{name:'Sign in to save my notes'})).toBeVisible();await expect(page.getByRole('textbox')).toHaveCount(0);
});
