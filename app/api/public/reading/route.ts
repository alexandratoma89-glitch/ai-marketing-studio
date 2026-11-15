import {requestReading} from '@/lib/tarot/service';import {getDeps,ipHash} from '@/lib/tarot/runtime';import {readJson,noStore} from '@/lib/commerce/http';import {publicError} from '@/lib/public/api';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request){try{const input=await readJson(request);return Response.json(await requestReading(input,ipHash(request),getDeps()),{status:202,headers:noStore});}catch(error){return publicError(error);}}
