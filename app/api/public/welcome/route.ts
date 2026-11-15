import {POST as original} from '../../welcome/route';
export async function POST(request:Request){const response=await original(request);if(response.ok)return response;return Response.json({code:response.status===429?'rate_limited':response.status<500?'invalid_input':'service_unavailable'},{status:response.status,headers:{'Cache-Control':'no-store'}});}
