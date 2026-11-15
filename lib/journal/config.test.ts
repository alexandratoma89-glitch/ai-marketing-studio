import test from 'node:test';import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {supabaseProjectUrl} from './config.ts';
test('Supabase Auth normalizes copied Data API URLs to the project origin',()=>{
 for(const value of ['https://project.supabase.co','https://project.supabase.co/',' https://project.supabase.co/rest/v1 ','https://project.supabase.co/rest/v1/','https://project.supabase.co/auth/v1'])assert.equal(supabaseProjectUrl(value),'https://project.supabase.co');
 assert.equal(supabaseProjectUrl('https://auth.example.com/'),'https://auth.example.com');
});
test('Supabase project URLs reject credentials, non-HTTPS URLs and unexpected endpoint data',()=>{
 for(const value of [undefined,'not a URL','http://project.supabase.co','https://user:password@project.supabase.co','https://project.supabase.co/rest/v1?apikey=secret','https://project.supabase.co/#secret','https://project.supabase.co/rest/v1/table'])assert.equal(supabaseProjectUrl(value),null);
});
test('real Supabase SSR SDK builds Google OAuth on auth/v1 instead of the REST gateway',async()=>{
 const client=createServerClient(supabaseProjectUrl('https://project.supabase.co/rest/v1')!,'public-test-key',{
  cookies:{getAll:()=>[],setAll:()=>{}},
  global:{fetch:async()=>{throw new Error('This URL-construction test must not make network calls');}},
 });
 const result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://www.thedivinework.com/api/account/callback'}});
 assert.equal(result.error,null);assert.ok(result.data.url);
 const url=new URL(result.data.url);assert.equal(url.hostname,'project.supabase.co');assert.equal(url.pathname,'/auth/v1/authorize');assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('redirect_to'),'https://www.thedivinework.com/api/account/callback');
});
