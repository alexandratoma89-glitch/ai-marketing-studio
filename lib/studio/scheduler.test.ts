import {test} from 'node:test';import assert from 'node:assert/strict';
import {schedulerAuthorized} from './scheduler.ts';
test('scheduled jobs retain existing authorization and accept an independent external scheduler token',()=>{
 const env={CRON_SECRET:'a'.repeat(64),SCHEDULER_SECRET:'b'.repeat(64)};
 assert.equal(schedulerAuthorized('Bearer '+env.CRON_SECRET,env),true);
 assert.equal(schedulerAuthorized('Bearer '+env.SCHEDULER_SECRET,env),true);
 assert.equal(schedulerAuthorized('Bearer '+env.SCHEDULER_SECRET,{CRON_SECRET:env.CRON_SECRET}),false);
 for(const value of [null,'','Bearer wrong',env.SCHEDULER_SECRET,'Basic '+env.SCHEDULER_SECRET,'Bearer '+'a'.repeat(4097)])assert.equal(schedulerAuthorized(value,env),false);
 assert.equal(schedulerAuthorized('Bearer short',{SCHEDULER_SECRET:'short'}),false);
 assert.equal(schedulerAuthorized('Bearer undefined',{}),false);
});
