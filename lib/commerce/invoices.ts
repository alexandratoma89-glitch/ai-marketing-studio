import type Stripe from 'stripe';
import type {CommerceDb,Order} from './types.ts';
import {HttpError} from './http.ts';
export function invoicesEnabled(env:Record<string,string|undefined>=process.env){return env.NODE_ENV!=='production'||(env.COMMERCE_MODE==='test'&&env.COMMERCE_INVOICES_ENABLED==='true'&&env.COMMERCE_INVOICES_DATABASE_READY==='true');}
export interface BookingInvoice {id:string;order_id:string;status:string;number:string|null;currency:string;total:number;hosted_url:string|null;pdf_url:string|null}
export function invoiceLink(value:unknown){if(value===null||value===undefined)return null;if(typeof value!=='string')throw new Error('invalid_invoice_link');const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!['invoice.stripe.com','pay.stripe.com'].includes(url.hostname))throw new Error('invalid_invoice_link');return url.href;}
export async function syncBookingInvoice(db:CommerceDb,stripe:Stripe,order:Order,expectedInvoice?:string){
 if(!invoicesEnabled())throw new HttpError(503,'Facturile de test nu sunt încă activate.');
 if(order.kind!=='booking'||!order.checkout_id)throw new HttpError(409,'Rezervarea nu are o sesiune Checkout eligibilă.');
 const session=await stripe.checkout.sessions.retrieve(order.checkout_id);
 const invoiceId=typeof session.invoice==='string'?session.invoice:session.invoice?.id;
 if(session.livemode!==false||session.mode!=='payment'||session.client_reference_id!==order.id||session.id!==order.checkout_id)throw new Error('invoice_checkout_mismatch');
 if(!invoiceId)throw new HttpError(409,'Stripe nu a atașat încă o factură acestei sesiuni. Sincronizarea nu creează o factură nouă.');
 if(expectedInvoice&&expectedInvoice!==invoiceId)throw new Error('invoice_reference_mismatch');
 const invoice=await stripe.invoices.retrieve(invoiceId);
 const customerId=typeof invoice.customer==='string'?invoice.customer:invoice.customer?.id;
 const sessionCustomer=typeof session.customer==='string'?session.customer:session.customer?.id;
 if(invoice.livemode!==false||invoice.id!==invoiceId||invoice.metadata?.order_id!==order.id||!customerId||sessionCustomer!==customerId||(order.customer_id&&order.customer_id!==customerId)||invoice.currency!==order.currency||invoice.total!==order.amount||!invoice.status||!['draft','open','paid','void','uncollectible'].includes(invoice.status))throw new Error('invoice_validation_failed');
 await db.command('invoice_record',{orderId:order.id,id:invoice.id,customerId,livemode:false,status:invoice.status,currency:invoice.currency,total:invoice.total,number:invoice.number,hostedUrl:invoiceLink(invoice.hosted_invoice_url),pdfUrl:invoiceLink(invoice.invoice_pdf)});
 return db.command<BookingInvoice>('invoice_get',{id:order.id});
}
