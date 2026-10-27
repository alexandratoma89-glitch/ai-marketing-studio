import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthFailureReason} from './oauth.ts';
test('OAuth diagnostics expose only fixed codes, never provider responses or secrets',()=>{
 for(const value of [new Error('permissions_failed_meta_100_private'),new Error('access_token=private'),new Error('https://provider/?code=private'),{message:'missing_permissions'},null])assert.equal(oauthFailureReason(value),'configuration_failed');
 for(const code of ['permissions_failed_meta_100','permissions_failed_network_error','short_token_failed','long_token_failed','missing_permissions','connection_save_failed','invalid_oauth_state'])assert.equal(oauthFailureReason(new Error(code)),code);
});
test('permission API failures retain a sanitized numeric code through OAuth',async()=>{
 const {finishOAuth}=await import('./oauth.ts');
 const previous={...process.env};
 Object.assign(process.env,{INSTAGRAM_APP_ID:'123',INSTAGRAM_APP_SECRET:'test-secret',INSTAGRAM_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),TAROT_SITE_URL:'http://localhost:3100'});
 try{
 const state='b'.repeat(64);
 const transport:typeof fetch=async(input)=>{
 const url=new URL(String(input));
 if(url.hostname==='api.instagram.com')return Response.json({access_token:'private-short'});
 if(url.pathname==='/access_token')return Response.json({access_token:'private-long',expires_in:5184000});
 if(url.pathname.endsWith('/me'))return Response.json({user_id:'123',username:'divinework.store',account_type:'BUSINESS'});
 return Response.json({error:{code:100,message:'private provider detail'}},{status:400});
 };
 await assert.rejects(()=>finishOAuth({command:async<T>()=>true as T},new URLSearchParams({state,code:'private-code'}),state,transport),error=>oauthFailureReason(error)==='permissions_failed_meta_100');
 }finally{for(const key of ['INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET','INSTAGRAM_TOKEN_ENCRYPTION_KEY','TAROT_SITE_URL']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
