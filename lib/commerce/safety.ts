import {createHmac,timingSafeEqual} from 'node:crypto';
// Explicit latest instruction: no live payments or customer emails in this release.
export const LIVE_COMMERCE_AUTHORIZED=false;
export const LIVE_CUSTOMER_EMAIL_AUTHORIZED=false;
export function testStripeKey(key:string|undefined){if(!key||!/^sk_test_/.test(key))throw new Error('A Stripe TEST secret key is required. Live keys are blocked.');return key;}
export function equalSecret(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function managementToken(id:string,secret:string,now=Date.now()){if(secret.length<32)throw new Error('Management signing key missing');const body=Buffer.from(JSON.stringify({id,exp:Math.floor(now/1000)+172800})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
export function verifyManagementToken(token:string,secret:string,now=Date.now()){if(secret.length<32||token.length>1024)throw new Error('Invalid link');const [body,signature,...extra]=token.split('.');if(extra.length||!signature||!equalSecret(signature,createHmac('sha256',secret).update(body).digest('base64url')))throw new Error('Invalid link');const data=JSON.parse(Buffer.from(body,'base64url').toString());if(!/^[a-f0-9-]{36}$/.test(data.id)||!Number.isFinite(data.exp)||data.exp<=now/1000)throw new Error('Expired link');return data.id as string;}
export const PRICE_CENTS=4900;
export const FIRST_PRICE_CENTS=4410;
export const MONTHLY_CENTS=1000;

export function marketingToken(id:string,secret:string){if(secret.length<32)throw new Error('Signing key missing');return createHmac('sha256',secret).update('marketing:'+id).digest('hex');}
