import {runwayConfiguration,checkRunwayConnection} from '@/lib/runway/connection';import {readJson,noStore,apiError} from '@/lib/commerce/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){const configuration=runwayConfiguration();return Response.json({...configuration,connection:configuration.secretPresent?'not_checked':'missing_secret'},{headers:noStore});}
export async function POST(request:Request){try{await readJson(request);return Response.json(await checkRunwayConnection(),{headers:noStore});}catch(e){return apiError(e);}}
