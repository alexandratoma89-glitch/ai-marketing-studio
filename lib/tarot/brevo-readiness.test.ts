import test from 'node:test';import assert from 'node:assert/strict';import {brevoReadiness} from './brevo-readiness.ts';
const env={BREVO_API_KEY:'private-provider-key-fixture',BREVO_SENDER_EMAIL:'private-sender@example.com'};
test('owner connection check verifies API access and sender without sending mail or exposing provider data',async()=>{
 const paths:string[]=[];
 const result=await brevoReadiness(env,async(url,options)=>{paths.push(String(url));assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');return Response.json(String(url).endsWith('/account')?{relay:{enabled:true},email:'account@example.com',companyName:'private company'}:{senders:[{email:env.BREVO_SENDER_EMAIL,active:true}]});});
 assert.deepEqual(paths,['https://api.brevo.com/v3/account','https://api.brevo.com/v3/senders']);assert.equal(result.reason,'connection_checked');assert.equal('senderActive' in result&&result.senderActive,true);assert.doesNotMatch(JSON.stringify(result),/private-provider|private-sender|account@example|private company/);
});
test('owner connection check distinguishes rejected keys and IP approval without leaking raw provider errors',async()=>{
 for(const [status,message,reason] of [[401,'Key private-provider-key-fixture is invalid','api_key_rejected'],[401,'Unrecognised IP address 192.0.2.1','ip_approval_required'],[403,'Access denied','provider_access_denied']] as const){const result=await brevoReadiness(env,async()=>Response.json({message},{status}));assert.equal(result.reason,reason);assert.doesNotMatch(JSON.stringify(result),/private-provider|192\.0\.2\.1|Access denied/);}
});
test('owner connection check fails safely for missing credentials and network failures',async()=>{
 let calls=0;assert.equal((await brevoReadiness({},async()=>{calls++;throw new Error('unexpected');})).reason,'api_key_missing');assert.equal(calls,0);assert.equal((await brevoReadiness(env,async()=>{throw new Error('network secret');})).reason,'provider_connection_failed');
});

test('diagnostics identify SMTP or masked values without exposing them, and trim copied whitespace',async()=>{
 for(const [value,kind] of [[' xsmtpsib-private-smtp-value\n','smtp_key'],['xkeysib-****','brevo_api_key'],['Divine Works Free Readings','unrecognized_format']]){
  const result=await brevoReadiness({...env,BREVO_API_KEY:value},async(_url,options)=>{assert.equal((options?.headers as Record<string,string>)['api-key'],value.trim());return Response.json({code:'unauthorized',message:'Key not found'},{status:401});});
  assert.equal('keyFormat' in result&&result.keyFormat?.kind,kind);assert.equal(result.reason,'api_key_rejected');assert.doesNotMatch(JSON.stringify(result),/private-smtp-value|Divine Works Free Readings/);
 }
});
test('a key allowed to read senders is not declared invalid because account-read permission is restricted',async()=>{
 const result=await brevoReadiness(env,async url=>String(url).endsWith('/account')?Response.json({message:'Insufficient scope'},{status:401}):Response.json({senders:[{email:env.BREVO_SENDER_EMAIL,active:true}]}));
 assert.equal(result.reason,'account_read_restricted');assert.equal('apiKeyAccepted' in result&&result.apiKeyAccepted,true);assert.equal('senderActive' in result&&result.senderActive,true);
});
