import type {InstagramDb} from '../instagram/db.ts';
import type {OwnDb} from './db.ts';
import {siteUrl} from '../tarot/runtime.ts';
export const ownerInstagramCallback=()=>`${siteUrl()}/api/studio/publish/instagram/callback`;
export const INSTAGRAM_HANDLES=['divinework.store','travelmellon'] as const;
export function instagramHandle(value:unknown){if(typeof value!=='string'||!(INSTAGRAM_HANDLES as readonly string[]).includes(value))throw new Error('unexpected_instagram_account');return value;}
export function instagramOAuthDb(db:OwnDb,username:string):InstagramDb{return {command:async<T>(action:string,data:Record<string,unknown>={})=>{const actions:Record<string,string>={oauth_start:'ig_oauth_start',oauth_consume:'ig_oauth_consume',connect:'ig_connect'};if(!actions[action])throw new Error('unsupported_oauth_action');return db.command<T>(actions[action],{...data,username});}};}
