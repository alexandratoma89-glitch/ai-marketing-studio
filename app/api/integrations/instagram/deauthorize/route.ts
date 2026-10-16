import {instagramDb} from '@/lib/instagram/db';import {revokeSignedRequest} from '@/lib/instagram/revocation';import {readBody,noStore} from '@/lib/commerce/http';
export const runtime='nodejs';
export async function POST(request:Request){try{const body=new URLSearchParams(await readBody(request,16384));await revokeSignedRequest(await instagramDb(),body.get('signed_request')??'',process.env.INSTAGRAM_APP_SECRET??'');return Response.json({ok:true},{headers:noStore});}catch{return Response.json({error:'Invalid request'},{status:400,headers:noStore});}}
