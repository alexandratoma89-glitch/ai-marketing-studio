import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthFailureReason} from './oauth.ts';
test('OAuth diagnostics expose only fixed codes, never provider responses or secrets',()=>{
 for(const value of [new Error('permissions_failed_meta_100_private'),new Error('access_token=private'),new Error('https://provider/?code=private'),{message:'missing_permissions'},null])assert.equal(oauthFailureReason(value),'configuration_failed');
 for(const code of ['permissions_failed_meta_100','permissions_failed_network_error','short_token_failed','long_token_failed','missing_permissions','connection_save_failed','invalid_oauth_state'])assert.equal(oauthFailureReason(new Error(code)),code);
});
test('only complete grants from the token exchange pass permission checks',async()=>{
 const {verifyGrantedPermissions}=await import('./meta.ts');
 for(const grants of ['instagram_business_basic,instagram_business_content_publish',['instagram_business_basic','instagram_business_content_publish']])assert.doesNotThrow(()=>verifyGrantedPermissions(grants));
 for(const grants of [undefined,null,[],{},''])assert.throws(()=>verifyGrantedPermissions(grants),/permission_grants_unavailable/);
 for(const grants of ['instagram_business_basic',['instagram_business_basic'],['instagram_business_content_publish'],['other']])assert.throws(()=>verifyGrantedPermissions(grants),/missing_permissions/);
});
