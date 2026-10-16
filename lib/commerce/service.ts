import {COMMERCE_TERMS_VERSION,taxConfig,PRICING_VERSION,PRIVATE_READING_BANI,FIRST_READING_BANI,MEMBERSHIP_BANI} from './pricing.ts';
import {randomUUID,createHash} from 'node:crypto';
import {marketingToken} from './safety.ts';
import {parseSignup} from '../tarot/types.ts';
import {HttpError} from './http.ts';
import type {CommerceDb,Order} from './types.ts';
export async function reserveOrder(db:CommerceDb,input:Record<string,unknown>,ipHash:string,verifyBot:(token:string)=>Promise<boolean>,signingSecret?:string){
 const signup=parseSignup(input);if(signup.website||!await verifyBot(signup.botToken))throw new HttpError(400,'Verificarea de securitate nu a reușit.');
 if(!['booking','membership'].includes(String(input.kind))||input.termsAccepted!==true||input.termsVersion!==COMMERCE_TERMS_VERSION)throw new HttpError(400,'Acceptă termenii serviciului pentru a continua.');
 if(input.kind==='booking'&&(!/^[a-f0-9-]{36}$/.test(String(input.slotId))||!['audio','video'].includes(String(input.meetingMode))))throw new HttpError(400,'Alege un interval și tipul întâlnirii.');
 const id=randomUUID();const consentTokenHash=signup.marketingConsent?createHash('sha256').update(marketingToken(id,signingSecret??'')).digest('hex'):null;
 const tax=taxConfig();
 const order=await db.command<Order & {error?:string}>('reserve',{...signup,id,consentTokenHash,taxStatus:tax.tax_status,taxRateId:tax.tax_rate_id,kind:input.kind,slotId:input.slotId,meetingMode:input.kind==='booking'?input.meetingMode:null,termsAccepted:true,termsVersion:input.termsVersion,ipHash});
 if(order.error)throw new HttpError(order.error==='limited'?429:409,order.error==='unavailable'?'Intervalul nu mai este disponibil. Alege altul.':'Există deja o solicitare în curs sau limita de solicitări a fost atinsă.');
 const expected=order.kind==='membership'?MEMBERSHIP_BANI:order.intro_discount?FIRST_READING_BANI:PRIVATE_READING_BANI;
 if(order.currency!=='ron'||order.pricing_version!==PRICING_VERSION||order.amount!==expected){await db.command('checkout_failed',{id:order.id});throw new HttpError(503,'Prețurile de test nu sunt încă sincronizate. Nu s-a inițiat nicio plată.');}
 return {...order,email:signup.email,firstName:signup.firstName};
}

export async function cancelOrder(db:CommerceDb,stripe:import('stripe').default,order:Order){
 const {subscriptionState}=await import('./stripe.ts');
 if(order.kind==='membership'&&order.subscription_id){const sub=await stripe.subscriptions.update(order.subscription_id,{cancel_at_period_end:true},{idempotencyKey:`cancel:${order.id}`});if(sub.livemode)throw new Error('Live response blocked');await db.command('subscription_event',{...subscriptionState(sub),eventId:`manual-cancel:${order.id}`,type:'manual.cancel',created:Math.floor(Date.now()/1000),livemode:false});}
 else if(order.kind==='booking'){const result=await db.command<Order & {error?:string}>('cancel_booking',{id:order.id});if(result.error||!result.payment_intent)throw new HttpError(409,'Anularea automată nu este disponibilă pentru această rezervare.');await stripe.refunds.create({payment_intent:result.payment_intent},{idempotencyKey:`refund:${order.id}`});}
 else throw new HttpError(409,'Solicitarea nu poate fi anulată.');
}
