import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {DECK} from './deck.ts';
import {POLICY_VERSION} from './types.ts';

test('Supabase migration: atomic admission, RLS, consent eligibility and delivery events',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile('supabase/migrations/202610160001_free_tarot.sql','utf8'));
  async function admit(email:string,ip:string,opted=false,token:string|null=null){const id=randomUUID();const result=await db.query<{result:{kind:string}}>('select request_free_tarot($1,$2,$3,$4,$5,$6,$7,$8) as result',[id,'Ana',email,opted,POLICY_VERSION,JSON.stringify(DECK[0]),ip.repeat(64),token]);return {id,...result.rows[0].result};}
  const no=await admit('no@example.ro','a');assert.equal(no.kind,'accepted');
  let rows=await db.query<{email:string}>('select * from tarot_campaign_eligible');assert.equal(rows.rows.length,0);
  const yes=await admit('yes@example.ro','b',true,'c'.repeat(64));assert.equal(yes.kind,'accepted');
  rows=await db.query<{email:string}>('select * from tarot_campaign_eligible');assert.equal(rows.rows.length,0,'unchecked/unconfirmed contacts never qualify');
  await db.query("select tarot_marketing_choice($1,'confirm')",['c'.repeat(64)]);
  rows=await db.query<{email:string}>('select * from tarot_campaign_eligible');assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].email,'yes@example.ro');
  await db.query("select tarot_marketing_choice($1,'withdraw')",['c'.repeat(64)]);
  rows=await db.query<{email:string}>('select * from tarot_campaign_eligible');assert.equal(rows.rows.length,0);
  await db.query("select tarot_marketing_choice($1,'confirm')",['c'.repeat(64)]);
  rows=await db.query<{email:string}>('select * from tarot_campaign_eligible');assert.equal(rows.rows.length,0,'withdrawn consent cannot be reactivated by the same token');
  const expired=await admit('expired@example.ro','f',true,'1'.repeat(64));
  await db.query("update tarot_consent_events set token_expires_at=now()-interval '1 second' where request_id=$1",[expired.id]);
  const expiredResult=await db.query<{result:{ok:boolean}}>("select tarot_marketing_choice($1,'confirm') as result",['1'.repeat(64)]);assert.equal(expiredResult.rows[0].result.ok,false);
  const dup=await admit('no@example.ro','d',true,'e'.repeat(64));assert.equal(dup.kind,'duplicate');
  const events=await db.query<{count:number}>('select count(*)::integer as count from tarot_consent_events');assert.equal(events.rows[0].count,3);
  for(let i=0;i<4;i++)await admit('no@example.ro','a');assert.equal((await admit('no@example.ro','a')).kind,'limited');
  // Webhook arrives before provider receipt; the event must not be lost.
  await db.query("select record_tarot_delivery('event-1','provider-1','email.delivered',now())");
  await db.query("select update_free_tarot($1,'generating')",[no.id]);
  await db.query("select update_free_tarot($1,'generated',$2)",[no.id,JSON.stringify({meaning:'test',guidance:'test',question:'test?'})]);
  await db.query("select update_free_tarot($1,'provider_accepted',null,'provider-1')",[no.id]);
  let status=await db.query<{status:string}>('select status from tarot_requests where id=$1',[no.id]);assert.equal(status.rows[0].status,'delivered');
  await db.query("select record_tarot_delivery('event-2','provider-1','email.bounced',now())");
  await db.query("select record_tarot_delivery('event-1','provider-1','email.delivered',now())");
  status=await db.query<{status:string}>('select status from tarot_requests where id=$1',[no.id]);assert.equal(status.rows[0].status,'bounced');
  const count=await db.query<{count:number}>('select count(*)::integer as count from tarot_delivery_events');assert.equal(count.rows[0].count,2,'event replay is idempotent');
  await db.query("update tarot_requests set requested_at=now()-interval '25 hours' where id=$1",[no.id]);
  assert.equal((await admit('no@example.ro','2')).kind,'accepted','rolling duplicate window expires');
  await db.exec("insert into tarot_requests(id,contact_id,policy_version,card) select gen_random_uuid(),(select id from tarot_contacts limit 1),'test','{}'::jsonb from generate_series(1,200)");
  assert.equal((await admit('global-limit@example.ro','3')).kind,'limited','global daily limit is shared');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from tarot_contacts'),/permission denied/);
  await assert.rejects(db.query('select * from tarot_campaign_eligible'),/permission denied/);
  await assert.rejects(db.query("select tarot_marketing_choice('x','confirm')"),/permission denied/);
  await db.exec('reset role');
 }finally{await db.close();}
});
