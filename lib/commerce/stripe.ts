import Stripe from 'stripe';
import {testStripeKey} from './safety.ts';
import type {Order,CommerceDb} from './types.ts';
export function stripeClient(){return new Stripe(testStripeKey(process.env.STRIPE_SECRET_KEY),{maxNetworkRetries:2,timeout:15000});}
export function checkoutParams(order:Order,email:string,origin:string):Stripe.Checkout.SessionCreateParams {
 const common:Stripe.Checkout.SessionCreateParams={client_reference_id:order.id,customer_email:email,metadata:{order_id:order.id},success_url:`${origin}/rezervare/status`,cancel_url:`${origin}/cont`,expires_at:Math.floor(Date.now()/1000)+1860,allowed_payment_method_types:['card'],locale:'ro',billing_address_collection:'required'};
 if(order.kind==='booking')return {...common,mode:'payment',line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:order.amount,product_data:{name:order.intro_discount?'Lectură privată 30 min · prima rezervare −10%':'Lectură privată 30 min'}}}],payment_intent_data:{metadata:{order_id:order.id}}};
 return {...common,mode:'subscription',payment_method_collection:'always',line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:1000,recurring:{interval:'month'},product_data:{name:'The Divine Work · Cartea zilei'}}}],subscription_data:{metadata:{order_id:order.id},...(order.intro_discount?{trial_period_days:30}:{}),trial_settings:{end_behavior:{missing_payment_method:'cancel'}}}};
}
export async function startCheckout(db:CommerceDb,stripe:Stripe,order:Order,origin:string){
 let session:Stripe.Checkout.Session;
 try{session=await stripe.checkout.sessions.create(checkoutParams(order,order.email,origin),{idempotencyKey:`checkout:${order.id}`});}catch(error){const status=(error as {statusCode?:number}).statusCode;await db.command([400,401,403,404].includes(status??0)?'checkout_failed':'checkout_uncertain',{id:order.id});throw error;}
 if(session.livemode||!session.url?.startsWith('https://checkout.stripe.com/'))throw new Error('Invalid test checkout');
 await db.command('attach_checkout',{id:order.id,checkoutId:session.id});return {url:session.url};
}
export function subscriptionState(subscription:Stripe.Subscription){
 const item=subscription.items.data[0];
 return {subscriptionId:subscription.id,customerId:typeof subscription.customer==='string'?subscription.customer:subscription.customer.id,memberStatus:subscription.status,memberUntil:subscription.status==='trialing'?subscription.trial_end:item?.current_period_end,cancelAtPeriodEnd:subscription.cancel_at_period_end,monthlyAmount:item?.price.unit_amount,currency:item?.price.currency};
}
export async function applyStripeEvent(db:CommerceDb,stripe:Stripe,event:Stripe.Event){
 if(event.livemode)throw new Error('Live Stripe event forbidden');
 const base={eventId:event.id,type:event.type,created:event.created,livemode:false};
 if(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired'].includes(event.type)){
  const session=event.data.object as Stripe.Checkout.Session;
  if(!session.client_reference_id)throw new Error('Missing order reference');
  const order=await db.command<Order>('get_order',{id:session.client_reference_id});if(!order)throw new Error('Unknown order');
  let subState:Record<string,unknown>={};
  if(session.subscription){const sub=await stripe.subscriptions.retrieve(typeof session.subscription==='string'?session.subscription:session.subscription.id);if(sub.livemode)throw new Error('Live subscription');subState=subscriptionState(sub);if(sub.items.data.length!==1||sub.items.data[0].price.recurring?.interval!=='month'||sub.items.data[0].price.recurring.interval_count!==1||subState.currency!=='usd')throw new Error('Wrong membership price');}
  if(event.type!=='checkout.session.expired'&&((order.kind==='booking'&&session.mode!=='payment')||(order.kind==='membership'&&session.mode!=='subscription')))throw new Error('Checkout kind mismatch');
  await db.command('checkout_event',{...base,...subState,orderId:order.id,checkoutId:session.id,currency:session.currency,amount:session.amount_total,paymentStatus:session.payment_status,customerId:typeof session.customer==='string'?session.customer:session.customer?.id,paymentIntent:typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id});
 }else if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'].includes(event.type)){
  let id:string|undefined;
  if(event.type.startsWith('customer.subscription.'))id=(event.data.object as Stripe.Subscription).id;
  else {const invoice=event.data.object as Stripe.Invoice;const ref=invoice.parent?.subscription_details?.subscription;id=typeof ref==='string'?ref:ref?.id;}
  if(!id)return;
  const sub=await stripe.subscriptions.retrieve(id);if(sub.livemode)throw new Error('Live subscription');
  await db.command('subscription_event',{...base,...subscriptionState(sub)});
 }else if(event.type==='charge.refunded'){
  const charge=event.data.object as Stripe.Charge;
  await db.command('refund_event',{...base,paymentIntent:typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id,amountRefunded:charge.amount_refunded});
 }
}
