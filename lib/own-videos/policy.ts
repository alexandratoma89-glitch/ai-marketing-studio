export const PLATFORMS=['instagram','facebook','youtube'] as const;
export type Platform=typeof PLATFORMS[number];
export const MAX_VIDEO_BYTES=150*1024*1024;
export const platform=(value:unknown):Platform=>{if(!PLATFORMS.includes(value as Platform))throw new Error('invalid_platform');return value as Platform;};
export function ownEnabled(){return process.env.OWN_VIDEOS_ENABLED==='true';}
export function providerEnabled(p:Platform){return ownEnabled()&&process.env[`OWN_VIDEOS_${p.toUpperCase()}_ENABLED`]==='true';}
export function pathFor(id:string){if(!/^[a-f\d-]{36}$/i.test(id))throw new Error('invalid_video_id');return `${id}/video.mp4`;}
export function validateUpload(value:Record<string,unknown>){
 if(value.type!=='video/mp4'||!Number.isSafeInteger(value.bytes)||Number(value.bytes)<32||Number(value.bytes)>MAX_VIDEO_BYTES||!Number.isFinite(value.duration)||Number(value.duration)<5||Number(value.duration)>150||!Number.isFinite(value.width)||!Number.isFinite(value.height)||Number(value.width)<360||Number(value.height)<640||Number(value.width)/Number(value.height)<.5||Number(value.width)/Number(value.height)>.65)throw new Error('invalid_clip');
 return {bytes:Number(value.bytes),duration:Number(value.duration),width:Number(value.width),height:Number(value.height)};
}
export function validateCopy(value:Record<string,unknown>){const title=typeof value.title==='string'?value.title.trim():'';const caption=typeof value.caption==='string'?value.caption.trim():'';if(!title||title.length>100||caption.length>2100)throw new Error('invalid_copy');return {title,caption};}
export function bucharestToIso(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('invalid_schedule');
 const base=Date.parse(value+'Z');const matches=[120,180].map(offset=>new Date(base-offset*60000)).filter(date=>{if(!Number.isFinite(date.getTime()))return false;const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');return parts===value;});
 if(matches.length!==1)throw new Error('ambiguous_schedule');return matches[0].toISOString();
}
