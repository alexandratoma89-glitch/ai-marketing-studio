import {NextRequest,NextResponse} from 'next/server';
import {ownDb} from '@/lib/own-videos/db';
import {finishOAuth,oauthFailureReason} from '@/lib/instagram/oauth';
import {instagramHandle,instagramOAuthDb,ownerInstagramCallback} from '@/lib/own-videos/instagram-oauth';
import {siteUrl} from '@/lib/tarot/runtime';
export const runtime='nodejs';
export async function GET(request:NextRequest){let status='connected',reason='';try{const cookie=request.cookies.get('own_instagram_oauth')?.value??'',separator=cookie.indexOf('.'),state=cookie.slice(0,separator),username=instagramHandle(cookie.slice(separator+1));await finishOAuth(instagramOAuthDb(await ownDb(),username),request.nextUrl.searchParams,state,fetch,{redirectUri:ownerInstagramCallback(),expectedUsername:username});}catch(error){status='oauth_failed';reason=oauthFailureReason(error);}const response=NextResponse.redirect(`${siteUrl()}/studio/publish?connection=${status}${reason?'&reason='+encodeURIComponent(reason):''}`);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');response.cookies.set('own_instagram_oauth','',{maxAge:0,path:'/api/studio/publish/instagram/callback'});return response;}
