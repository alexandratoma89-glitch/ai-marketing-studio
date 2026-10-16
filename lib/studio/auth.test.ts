import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorized,credentialsReady} from './auth.ts';
const password='a-long-test-password-over-24-characters';
const basic=(name:string,pw:string)=>'Basic '+Buffer.from(`${name}:${pw}`).toString('base64');
test('studio stays locked with missing or weak credentials',async()=>{for(const pw of [undefined,'short']){assert.equal(credentialsReady('owner',pw),false);assert.equal(await authorized(basic('owner',password),'owner',pw),false);}});
test('only correct credentials allow access',async()=>{assert.equal(await authorized(basic('owner',password),'owner',password),true);for(const header of [null,'Basic !!!','Bearer token',basic('other',password),basic('owner','wrong')])assert.equal(await authorized(header,'owner',password),false);});
