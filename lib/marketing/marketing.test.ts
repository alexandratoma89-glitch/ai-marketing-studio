import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {testDb} from '../commerce/test-support.ts';
import {BrevoMarketing,enabled,sync,createDraft,suppressionEvent,type MarketingDb,type Env} from './service.ts';
const env:Env={CRON_SECRET:'c'.repeat(32),MARKETING_DATABASE_READY:'true',BREVO_MARKETING_ENABLED:'true',BREVO_MARKETING_API_KEY:'private-marketing-key',BREVO_MARKETING_LIST_ID:'42',BREVO_MARKETING_WEBHOOK_SECRET:'a'.repeat(32),BREVO_SENDER_EMAIL:'hello@example.com',BUSINESS_OPERATOR_NAME:'Example owner',BUSINESS_CONTACT_EMAIL:'hello@example.com'};

test('marketing configuration is independent of the working free-reading key',()=>{
 assert.equal(enabled(env),true);assert.equal(enabled({...env,BREVO_MARKETING_API_KEY:undefined,BREVO_API_KEY:'free-reading-key'}),false);assert.equal(enabled({...env,BREVO_MARKETING_LIST_ID:'0'}),false);
});
test('Brevo client respects provider blocks, never clears blacklists and creates unscheduled drafts only',async()=>{
 const calls:{url:string;body:any;method:string}[]=[];
 const provider=new BrevoMarketing(env,(async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null,method:init?.method??'GET'});return Response.json(String(url).includes('emailCampaigns')?{id:123}:String(url).includes('blocked')?{emailBlacklisted:true}:{emailBlacklisted:false});}) as typeof fetch);
 assert.equal(await provider.add('blocked@example.com','Ana'),false);assert.equal(calls.length,1);
 assert.equal(await provider.add('yes@example.com','Ana'),true);assert.equal(calls[2].body.emailBlacklisted,undefined);assert.deepEqual(calls[2].body.listIds,[42]);
 await provider.remove('yes@example.com');assert.match(calls[3].url,/contacts\/yes%40example.com$/);
 assert.equal(await provider.draft('<Subject>','<script>alert(1)</script>\n\nHello','reference'),123);
 const draft=calls[4];assert.equal(draft.body.scheduledAt,undefined);assert.match(draft.body.htmlContent,/&lt;script&gt;/);assert.match(draft.body.htmlContent,/\{\{ unsubscribe \}\}/);assert.deepEqual(draft.body.recipients,{listIds:[42]});assert.ok(!calls.some(c=>c.url.includes('sendNow')||c.url.includes('smtp/email')));
});
test('marketing webhook recognizes withdrawals and permanent delivery suppression',()=>{
 for(const event of ['unsubscribe','unsubscribed','spam','complaint','hardBounce','hard_bounce','blocked','invalid'])assert.equal(suppressionEvent(event),true,event);
 for(const event of ['delivered','click','opened','soft_bounce',null])assert.equal(suppressionEvent(event),false);
});
test('database sync uses confirmed latest consent, survives uncertain writes, removes withdrawals and deduplicates draft creation',async()=>{
 const {sql}=await testDb();
 try{
  await sql.exec(await readFile('supabase/migrations/202611160016_marketing.sql','utf8'));
  const db:MarketingDb={async command<T>(action:string,data:Record<string,unknown>={}){const result=await sql.query<{result:T}>('select marketing_command($1,$2::jsonb) result',[action,JSON.stringify(data)]);return result.rows[0].result;}};
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  for(let i=0;i<3;i++){
   await sql.query('insert into tarot_contacts(id,email,first_name) values($1,$2,$3)',[ids[i],`person${i}@example.com`,'Ana']);
   await sql.query('insert into tarot_requests(id,contact_id,policy_version,card,status) values($1,$2,$3,$4,$5)',[randomUUID(),ids[i],'2026-10-16.v1','{}','provider_accepted']);
   const request=await sql.query<{id:string}>('select id from tarot_requests where contact_id=$1',[ids[i]]);
   await sql.query('insert into tarot_consent_events(contact_id,request_id,opted_in,policy_version,confirmed_at,token_hash) values($1,$2,$3,$4,$5,$6)',[ids[i],request.rows[0].id,i!==2,'2026-10-16.v1',i===0?new Date().toISOString():null,String(i).repeat(64)]);
  }
  assert.equal((await db.command<{eligible:number}>('status')).eligible,1);
  const additions:string[]=[],removals:string[]=[];
  let fail=true;
  const provider={async add(email:string){additions.push(email);if(fail)throw new Error('network response lost');return true;},async remove(email:string){removals.push(email);}};
  assert.equal((await sync(db,provider)).failed,1);
  assert.equal((await db.command<{pending:number}>('status')).pending,1);
  fail=false;await sync(db,provider);assert.deepEqual(additions,['person0@example.com','person0@example.com']);
  assert.equal((await db.command<{pending:number}>('status')).pending,0);
  await db.command('suppress',{email:'person0@example.com'});await db.command('suppress',{email:'person0@example.com'});
  assert.equal((await db.command<{eligible:number}>('status')).eligible,0);await sync(db,provider);assert.deepEqual(removals,['person0@example.com']);
  // Re-confirming an old consent cannot clear the persistent provider suppression.
  await sql.query('update tarot_consent_events set withdrawn_at=null where contact_id=$1',[ids[0]]);
  assert.equal((await db.command<{eligible:number}>('status')).eligible,0);
  await sql.query('update tarot_consent_events set confirmed_at=now() where contact_id=$1',[ids[1]]);await sync(db,provider);
  const lease=randomUUID();assert.equal((await db.command<{claimed:boolean}>('claim',{token:lease})).claimed,true);assert.equal((await sync(db,provider)).busy,true);await db.command('release',{token:lease});
  let draftCalls=0;const draftProvider={async checkAudience(){},async draft(){draftCalls++;throw new Error('response lost');}};const draft={id:randomUUID(),subject:'Hello',body:'A message'};
  await assert.rejects(()=>createDraft(db,draftProvider,draft),/draft_uncertain/);await assert.rejects(()=>createDraft(db,draftProvider,draft),/draft_already_requested/);assert.equal(draftCalls,1);
  const status=await db.command<{drafts:{state:string}[]}>('status');assert.equal(status.drafts[0].state,'uncertain');
  await sql.exec('set role anon');await assert.rejects(()=>sql.query("select marketing_command('status')"),/permission denied/);await sql.exec('reset role');
 }finally{await sql.close();}
});

 test('list validation rejects extra recipients and removal remains unconfirmed while membership persists',async()=>{
 const audience=new BrevoMarketing(env,(async()=>Response.json({contacts:[{email:'unconfirmed@example.com'}]})) as typeof fetch);
 await assert.rejects(()=>audience.checkAudience(['confirmed@example.com']),/audience_mismatch/);
 const valid=new BrevoMarketing(env,(async()=>Response.json({contacts:[{email:'confirmed@example.com'}]})) as typeof fetch);await valid.checkAudience(['confirmed@example.com']);
 const removal=new BrevoMarketing(env,(async()=>Response.json({listIds:[42]})) as typeof fetch);await assert.rejects(()=>removal.remove('confirmed@example.com'),/removal_unconfirmed/);
 });
