import {NextResponse} from 'next/server';
import {instagramDb} from '@/lib/instagram/db';import {startOAuth} from '@/lib/instagram/oauth';import {readJson,apiError} from '@/lib/commerce/http';
export const runtime='nodejs';
export async function POST(request:Request){try{await readJson(request);const {state,url}=await startOAuth(await instagramDb());const response=NextResponse.json({url},{headers:{'Cache-Control':'no-store'}});response.cookies.set('instagram_oauth',state,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/studio/instagram/callback'});return response;}catch(e){return apiError(e);}}
