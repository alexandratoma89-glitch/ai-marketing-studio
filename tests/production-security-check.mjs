// Run after a build with NEXT_PUBLIC_TURNSTILE_SITE_KEY unset so server-runtime
// overrides can exercise both configured and missing-key states in the same build.
// Uses the production server and a mocked security provider only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
const port=3102,origin=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
async function scenario(kind){
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',COMMERCE_MODE:'test',TAROT_SITE_URL:origin,NEXT_PUBLIC_TURNSTILE_SITE_KEY:kind==='missing'?'':'mock-public-site-key'},stdio:'ignore'});
 const exited=new Promise(resolve=>server.once('exit',resolve));
 try{
  let ready=false;for(let n=0;n<100;n++){try{if((await fetch(`${origin}/tarot-gratuit/rezervare`)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,300));}assert.ok(ready,'production server starts');
  const page=await browser.newPage();const errors=[];let scripts=0;page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/commerce/availability',route=>route.fulfill({json:{slots:[{id:'11111111-1111-4111-8111-111111111111',startsAt:'2026-11-15T15:00:00+02:00',modes:['audio','video']}]}}));
  await page.route('https://challenges.cloudflare.com/**',route=>{scripts++;if(kind==='load_failure')return route.abort();return route.fulfill({contentType:'application/javascript',body:kind==='render_failure'?'window.turnstile={render:function(){throw new Error("invalid widget config")},remove:function(){throw new Error("cleanup failed")}};':'window.turnstile={render:function(el,options){setTimeout(function(){options.callback("mock-token")},0);return "widget"},remove:function(){throw new Error("cleanup failed")}};'});});
  await page.goto(`${origin}/tarot-gratuit/rezervare`);
  await page.getByRole('heading',{name:'Lectură privată.'}).waitFor();
  if(kind==='missing'){await page.getByRole('alert').filter({hasText:'nu este încă configurată'}).waitFor();assert.equal(scripts,0);}
  if(kind==='render_failure')await page.getByRole('alert').filter({hasText:'nu este disponibilă'}).waitFor();
  if(kind==='load_failure')await page.getByRole('alert').filter({hasText:'nu s-a încărcat'}).waitFor();
  if(kind!=='success')assert.equal(await page.getByRole('button',{name:/Continuă către Stripe Checkout/}).isDisabled(),true);
  else{await page.getByRole('combobox').selectOption('11111111-1111-4111-8111-111111111111');await page.getByRole('button',{name:/Continuă către Stripe Checkout/}).waitFor();await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:/Continuă către Stripe Checkout/}).isDisabled(),false);await page.getByRole('link',{name:'Gestionează sau anulează o solicitare'}).click();await page.waitForURL('**/cont');}
  assert.deepEqual(errors,[],`no customer-page crash (${kind})`);assert.equal((await page.locator('body').innerText()).includes('Application error'),false);await page.close();console.log(`PASS production security check: ${kind}`);
 }finally{server.kill('SIGTERM');await exited;}
}
try{for(const kind of ['missing','render_failure','load_failure','success'])await scenario(kind);}finally{await browser.close();}
