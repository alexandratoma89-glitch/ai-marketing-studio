import {NextResponse} from 'next/server';
import {readJson,apiError} from '@/lib/commerce/http';
import {ownEnabled} from '@/lib/own-videos/policy';
import {ownDb} from '@/lib/own-videos/db';
import {startOAuth} from '@/lib/instagram/oauth';
import {instagramHandle,instagramOAuthDb,ownerInstagramCallback} from '@/lib/own-videos/instagram-oauth';
export const runtime='nodejs';
export async function POST(request:Request){try{const input=await readJson(request);if(!ownEnabled())throw new Error('own_videos_disabled');const username=instagramHandle(input.username);const {state,url}=await startOAuth(instagramOAuthDb(await ownDb(),username),ownerInstagramCallback());const response=NextResponse.json({url},{headers:{'Cache-Control':'no-store'}});response.cookies.set('own_instagram_oauth',state+'.'+username,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/studio/publish/instagram/callback'});return response;}catch(error){return apiError(error);}}
