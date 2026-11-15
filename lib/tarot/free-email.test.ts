import test from 'node:test';import assert from 'node:assert/strict';
import {FreeReadingEmailProvider,freeReadingEmailConfigured,freeReadingEmailRequirements} from './free-email.ts';
import {emailConfigured} from '../launch/config.ts';
import {LIVE_COMMERCE_AUTHORIZED,LIVE_CUSTOMER_EMAIL_AUTHORIZED} from '../commerce/safety.ts';
import {requestReading} from './service.ts';import {MemoryStore} from './store.ts';import {DemoGenerator} from './providers.ts';
const configured={NODE_ENV:'production',TAROT_EMAIL_MODE:'live',FREE_READING_EMAIL_ENABLED:'true',FREE_READING_SENDER_VERIFIED:'true',BREVO_API_KEY:'test-key-never-real',BREVO_SENDER_EMAIL:'sender@example.com',BREVO_REPLY_TO:'reply@example.com',BREVO_WEBHOOK_SECRET:'x'.repeat(32),BUSINESS_OPERATOR_NAME:'Test operator',BUSINESS_CONTACT_EMAIL:'contact@example.com'};
const base={purpose:'free_reading' as const,to:'reader@example.com',subject:'A requested card',html:'<p>Your requested reading</p>',text:'Your requested reading',requestId:'00000000-0000-4000-8000-000000000001'};
test('free delivery requires all settings and cannot unlock commercial sending or payments',async()=>{
 assert.equal(freeReadingEmailConfigured(configured),true);
 for(const [name] of freeReadingEmailRequirements(configured))assert.equal(freeReadingEmailConfigured({...configured,[name]:undefined}),false,name);
 let calls=0;const transport:typeof fetch=async()=>{calls++;return Response.json({messageId:'test-receipt'});};
 for(const env of [{...configured,FREE_READING_EMAIL_ENABLED:'false'},{...configured,NODE_ENV:'development'},{...configured,TAROT_EMAIL_MODE:'mock'}])await assert.rejects(new FreeReadingEmailProvider(env,transport).send(base),/not_ready/);
 await assert.rejects(new FreeReadingEmailProvider(configured,transport).send({...base,purpose:'commerce'}),/only/);
 await assert.rejects(new FreeReadingEmailProvider(configured,transport).send({...base,purpose:undefined}),/only/);
 assert.equal(calls,0);assert.equal(LIVE_COMMERCE_AUTHORIZED,false);assert.equal(LIVE_CUSTOMER_EMAIL_AUTHORIZED,false);
 assert.equal(emailConfigured({...configured,TAROT_SITE_URL:'https://www.thedivinework.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',TAROT_DATABASE_READY:'true',TAROT_IP_HASH_SECRET:'y'.repeat(32),TURNSTILE_SECRET_KEY:'test',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'test',TAROT_PRIVACY_READY:'true'}),true);
});
test('free delivery sends the original chosen card once, records acceptance and never equates acceptance with delivery',async()=>{
 const store=new MemoryStore();const sent:any[]=[];
 const provider=new FreeReadingEmailProvider(configured,async(url,options)=>{assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(options?.redirect,'error');sent.push(JSON.parse(String(options?.body)));return Response.json({messageId:'test-receipt'});});
 const input={firstName:'Ana',email:'reader@example.com',locale:'en',cardId:'thestar',marketingConsent:false,policyVersion:'2026-10-16.v1',botToken:'test',website:''};
 const deps={store,email:provider,generator:new DemoGenerator(),siteUrl:'https://www.thedivinework.com',verifyBot:async()=>true};
 await requestReading(input,'ip',deps);await requestReading(input,'ip',deps);
 assert.equal(sent.length,1);assert.match(sent[0].textContent,/The Star/);assert.deepEqual(sent[0].tags,['divineworks-free-reading']);assert.doesNotMatch(sent[0].textContent,/confirm.*subscription/i);assert.equal([...store.requests.values()][0].status,'provider_accepted');
});
test('ambiguous free delivery stays recorded and cannot be retried by resubmitting',async()=>{
 const store=new MemoryStore();let calls=0;
 const provider=new FreeReadingEmailProvider(configured,async()=>{calls++;throw new Error('network failed after sending');});
 const input={firstName:'Ana',email:'reader@example.com',locale:'ro',cardId:'thestar',marketingConsent:false,policyVersion:'2026-10-16.v1',botToken:'test',website:''};
 const deps={store,email:provider,generator:new DemoGenerator(),siteUrl:'https://www.thedivinework.com',verifyBot:async()=>true};
 await assert.rejects(requestReading(input,'ip',deps));await requestReading(input,'ip',deps);
 assert.equal(calls,1);assert.equal([...store.requests.values()][0].status,'email_failed');
});

test('delivery failure is reported as an unconfirmed free email rather than an unavailable paid feature',async()=>{
 const {publicError}=await import('../public/api.ts');const store=new MemoryStore();
 const input={firstName:'Ana',email:'reader@example.com',locale:'en',cardId:'thestar',marketingConsent:false,policyVersion:'2026-10-16.v1',botToken:'test',website:''};
 try{await requestReading(input,'ip',{store,email:{send:async()=>{throw new Error('private-provider-secret');}},generator:new DemoGenerator(),siteUrl:'https://www.thedivinework.com',verifyBot:async()=>true});assert.fail('expected send failure');}
 catch(error){const response=publicError(error);assert.equal(response.status,503);assert.deepEqual(await response.json(),{code:'reading_email_failed'});assert.equal([...store.requests.values()][0].status,'email_failed');}
});

test('free email trims incidental copied whitespace from the API key',async()=>{
 const provider=new FreeReadingEmailProvider({...configured,BREVO_API_KEY:' \ttest-key\n'},async(_url,options)=>{assert.equal((options?.headers as Record<string,string>)['api-key'],'test-key');return Response.json({messageId:'test-receipt'});});
 assert.equal((await provider.send(base)).status,'provider_accepted');
});
