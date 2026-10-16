import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleVideos, approveVideo, scheduleVideo, publishApproved} from './workflow.ts';
test('unapproved content cannot be scheduled',()=>{assert.throws(()=>scheduleVideo(sampleVideos[0]));});
test('approval permits scheduling without mutating original',()=>{const approved=approveVideo(sampleVideos[0]);assert.equal(scheduleVideo(approved).status,'scheduled');assert.equal(sampleVideos[0].status,'review');});
test('unapproved content never reaches publishing adapter',async()=>{let called=false;await assert.rejects(publishApproved(sampleVideos[0],{publish:async()=>{called=true;return {externalId:'x'};}}));assert.equal(called,false);});
