import {test,expect} from '@playwright/test';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {POLICY_VERSION} from '../lib/tarot/types';
test('free reading signup: required fields, unchecked optional consent, private confirmation, mock email',async({page})=>{
 await page.goto('/tarot-gratuit');
 await page.getByRole('button',{name:'Descoperă cartea ta gratuită'}).click();
 const consent=page.getByRole('checkbox');await expect(consent).not.toBeChecked();
 const name=page.getByLabel('Prenume'),email=page.getByRole('textbox',{name:'Email (obligatoriu)',exact:true});
 await page.getByRole('button',{name:'Trimite-mi lectura prin email'}).click();
 await expect(page).toHaveURL(/tarot-gratuit$/);
 await name.fill('Ana');await email.fill('not-an-email');
 await page.getByRole('button',{name:'Trimite-mi lectura prin email'}).click();await expect(page).toHaveURL(/tarot-gratuit$/);
 const address=`reading-${Date.now()}@example.ro`;await email.fill(address);
 await page.getByRole('button',{name:'Trimite-mi lectura prin email'}).click();
 await expect(page).toHaveURL(/\/tarot-gratuit\/multumim$/);await expect(page.getByRole('heading',{name:'Mulțumim pentru încredere.'})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(address);await expect(page.locator('body')).not.toContainText('Semnificație simbolică');
 await expect(page.getByRole('link',{name:'Rezervă o lectură'})).toBeVisible();await expect(page.locator('body')).toContainText('49 USD');await expect(page.locator('body')).toContainText('10 USD/lună');
 const path=join(tmpdir(),'arcana-private-outbox');const messages=await Promise.all((await readdir(path)).map(async file=>JSON.parse(await readFile(join(path,file),'utf8'))));
 const message=messages.find(m=>m.to===address);expect(message).toBeTruthy();expect(message.html).toContain('Întrebare de reflecție');expect(message.html).toContain('<img');expect(message.html).not.toContain('/confirma');
});
test('mobile signup supports optional consent and fits viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/tarot-gratuit');await page.getByRole('button',{name:'Descoperă cartea ta gratuită'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('Prenume').fill('Maria');await page.getByRole('textbox',{name:'Email (obligatoriu)',exact:true}).fill(`consented-${Date.now()}@example.ro`);await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Trimite-mi lectura prin email'}).click();await expect(page).toHaveURL(/\/multumim$/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('API rejects cross-origin, malformed, oversized and bot submissions; duplicates expose no contact details',async({request})=>{
 const data={firstName:'Ioana',email:`api-${Date.now()}@example.ro`,marketingConsent:false,policyVersion:POLICY_VERSION,botToken:'development-only',website:''};
 const headers={Origin:'http://localhost:3100'};
 expect((await request.post('/api/tarot/request',{headers:{Origin:'https://evil.example'},data})).status()).toBe(403);
 expect((await request.post('/api/tarot/request',{headers,data:{...data,email:'bad'}})).status()).toBe(400);
 expect((await request.post('/api/tarot/request',{headers,data:{...data,website:'spam'}})).status()).toBe(400);
 expect((await request.post('/api/tarot/request',{headers,data:{...data,padding:'x'.repeat(9000)}})).status()).toBe(413);
 const first=await request.post('/api/tarot/request',{headers,data});const duplicate=await request.post('/api/tarot/request',{headers,data});expect(first.status()).toBe(202);expect(duplicate.status()).toBe(202);expect(await first.json()).toEqual({accepted:true});expect(await duplicate.json()).toEqual({accepted:true});
});
test('existing dashboard and library remain available',async({page})=>{await page.context().setHTTPCredentials({username:'test-owner',password:'test-only-password-with-at-least-24-characters'});await page.goto('/studio');await expect(page.getByRole('heading',{name:/Inspirație/})).toBeVisible();await page.getByRole('button',{name:'Bibliotecă video',exact:true}).click();await expect(page.getByRole('heading',{name:/Bibliotecă video/})).toBeVisible();});

test('homepage is public; studio rejects anonymous and incorrect credentials',async({page,request})=>{await page.goto('/');await expect(page.getByRole('heading',{name:/perspectivă/})).toBeVisible();await expect(page.getByRole('heading',{name:/Inspirație/})).toHaveCount(0);expect((await request.get('/studio')).status()).toBe(401);expect((await request.get('/studio',{headers:{Authorization:'Basic '+Buffer.from('wrong:wrong').toString('base64')}})).status()).toBe(401);expect((await request.get('/studio/nested')).status()).toBe(401);});

test('launch checklist is private and exposes setting names without credential values',async({page,request})=>{expect((await request.get('/studio/launch')).status()).toBe(401);await page.context().setHTTPCredentials({username:'test-owner',password:'test-only-password-with-at-least-24-characters'});await page.goto('/studio/launch');await expect(page.getByRole('heading',{name:'Pregătim lansarea.'})).toBeVisible();await expect(page.locator('body')).toContainText('TAROT_EMAIL_MODE');await expect(page.locator('body')).not.toContainText('test-only-password-with-at-least-24-characters');});

test('email consent confirmation and withdrawal work independently of the free reading',async({request})=>{const email=`consent-flow-${Date.now()}@example.ro`;const headers={Origin:'http://localhost:3100'};const response=await request.post('/api/tarot/request',{headers,data:{firstName:'Ana',email,marketingConsent:true,policyVersion:POLICY_VERSION,website:'',botToken:'development-only'}});expect(response.status()).toBe(202);const path=join(tmpdir(),'arcana-private-outbox');const messages=await Promise.all((await readdir(path)).map(async file=>JSON.parse(await readFile(join(path,file),'utf8'))));const message=messages.find(m=>m.to===email);const token=message.text.match(/confirma#token=([a-f0-9]{64})/)?.[1];expect(token).toBeTruthy();expect((await request.post('/api/tarot/consent',{headers,data:{token,action:'confirm'}})).status()).toBe(200);expect((await request.post('/api/tarot/consent',{headers,data:{token,action:'withdraw'}})).status()).toBe(200);expect((await request.post('/api/tarot/consent',{headers,data:{token,action:'confirm'}})).status()).toBe(400);});
