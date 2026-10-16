import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyWebhook(body:string, headers:Headers, secret:string, now=Date.now()):boolean {
 const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!id||!stamp||!/^\d+$/.test(stamp)||!signatures||Math.abs(now/1000-Number(stamp))>300||!secret.startsWith('whsec_'))return false;
 const expected=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${body}`).digest();
 return signatures.split(' ').some(signature=>{const [version,value]=signature.split(',');if(version!=='v1'||!value)return false;const actual=Buffer.from(value,'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected);});
}
