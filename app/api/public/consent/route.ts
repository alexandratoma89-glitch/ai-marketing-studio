import {POST as original} from '../../tarot/consent/route';
export async function POST(request:Request){const response=await original(request);if(response.ok)return response;return Response.json({code:'invalid_link'},{status:response.status,headers:{'Cache-Control':'no-store'}});}
