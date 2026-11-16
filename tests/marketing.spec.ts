import {test,expect} from '@playwright/test';
const authorization='Basic '+Buffer.from('test-owner:test-only-password-with-at-least-24-characters').toString('base64');
test('marketing endpoints are private, cron and webhook reject missing secrets, and writes require same origin',async({request})=>{
 for(const path of ['/studio/marketing','/api/studio/marketing','/api/jobs/marketing'])expect((await request.get(path)).status()).toBe(401);
 expect((await request.post('/api/integrations/brevo/marketing',{data:{event:'unsubscribe',email:'owner@example.com'}})).status()).toBe(401);
 expect((await request.post('/api/studio/marketing',{headers:{Authorization:authorization,Origin:'https://evil.example'},data:{action:'sync'}})).status()).toBe(403);
 const status=await request.get('/api/studio/marketing',{headers:{Authorization:authorization}});expect(status.status()).toBe(200);expect((await status.json()).settings.BREVO_MARKETING_ENABLED).toBe(false);
});
test('owner previews a campaign and creates only one Brevo draft, with final sending in Brevo',async({page})=>{
 await page.setExtraHTTPHeaders({Authorization:authorization});const writes:any[]=[];
 await page.route('**/api/studio/marketing',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{settings:Object.fromEntries(['MARKETING_DATABASE_READY','BREVO_MARKETING_ENABLED','BREVO_MARKETING_API_KEY','BREVO_MARKETING_LIST_ID','BREVO_MARKETING_WEBHOOK_SECRET','CRON_SECRET','BREVO_SENDER_EMAIL','BUSINESS_OPERATOR_NAME','BUSINESS_CONTACT_EMAIL'].map(key=>[key,true])),eligible:2,synced:2,pending:0,drafts:[]}});
  writes.push(route.request().postDataJSON());return route.fulfill({json:{providerId:123}});
 });
 await page.goto('/studio/marketing');
 for(const width of [1288,390]){
  await page.setViewportSize({width,height:900});
  const panel=page.locator('.marketing-studio .tarot-info'),setting=panel.locator('p').first();
  await expect(setting).toBeVisible();
  expect((await setting.boundingBox())!.width).toBeGreaterThan((await panel.boundingBox())!.width*0.8);
  expect((await page.getByRole('button',{name:'Sincronizează acum'}).boundingBox())!.width).toBeGreaterThan(150);
 }
 await page.screenshot({path:'/tmp/marketing-layout-mobile.png',fullPage:true});
 await page.getByLabel('Subiect',{exact:true}).fill('Noutăți Divine Works');await page.getByLabel('Mesaj',{exact:true}).fill('O invitație la reflecție.');
 await expect(page.locator('.marketing-studio form p').filter({hasText:'O invitație la reflecție.'})).toBeVisible();await page.getByRole('button',{name:'Creează ciornă în Brevo'}).click();
 await expect(page.getByRole('button',{name:'Creează ciornă în Brevo'})).toBeDisabled();expect(writes).toHaveLength(1);expect(writes[0].action).toBe('draft');expect(writes[0].subject).toBe('Noutăți Divine Works');
 await expect(page.getByRole('status').filter({hasText:'Ciornă creată'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
