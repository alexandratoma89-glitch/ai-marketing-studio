import {createHash,timingSafeEqual} from 'node:crypto';
type Env=Record<string,string|undefined>;
// Retain the existing cron token; the external scheduler gets a separate, revocable token.
export function schedulerAuthorized(header:string|null,env:Env=process.env){
 if(!header||header.length>4096)return false;
 const supplied=createHash('sha256').update(header).digest();
 return [env.CRON_SECRET,env.SCHEDULER_SECRET].some(secret=>typeof secret==='string'&&secret.length>=32&&secret.length<=4000&&timingSafeEqual(supplied,createHash('sha256').update(`Bearer ${secret}`).digest()));
}
