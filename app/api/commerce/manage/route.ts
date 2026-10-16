import {cancelOrder} from '@/lib/commerce/service';
import {commerceDb} from '@/lib/commerce/db';import {assertTestCommerce,tokenSecret} from '@/lib/commerce/runtime';import {readJson,apiError,noStore,HttpError} from '@/lib/commerce/http';import {verifyManagementToken} from '@/lib/commerce/safety';import {stripeClient} from '@/lib/commerce/stripe';import type {Order} from '@/lib/commerce/types';
export const runtime='nodejs';
export async function POST(request:Request){try{assertTestCommerce();const {token,action}=await readJson(request);let id;try{id=verifyManagementToken(String(token??''),tokenSecret());}catch{throw new HttpError(401,'Link invalid sau expirat. Solicită un link nou.');}const db=await commerceDb();const order=await db.command<Order|null>('get_order',{id});if(!order)throw new HttpError(404,'Solicitare indisponibilă.');
 if(action==='cancel')await cancelOrder(db,stripeClient(),order);
 const current=await db.command<Order>('get_order',{id});return Response.json({kind:current.kind,status:current.status,amount:current.amount,currency:current.currency,taxStatus:current.tax_status,startsAt:current.startsAt,meetingMode:current.meeting_mode,memberStatus:current.member_status,memberUntil:current.member_until,cancelAtPeriodEnd:current.cancel_at_period_end,testMode:true},{headers:noStore});
 }catch(error){return apiError(error);}}
