import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthFailureReason} from './oauth.ts';
test('OAuth diagnostics expose only fixed codes, never provider responses or secrets',()=>{
 for(const value of [new Error('access_token=private'),new Error('https://provider/?code=private'),{message:'missing_permissions'},null])assert.equal(oauthFailureReason(value),'configuration_failed');
 for(const code of ['short_token_failed','long_token_failed','missing_permissions','connection_save_failed','invalid_oauth_state'])assert.equal(oauthFailureReason(new Error(code)),code);
});
