import type { Card } from './deck.ts';
import {DECK} from './deck-data.ts';
import {isLocale,type Locale} from '../public/i18n.ts';
export const POLICY_VERSION='2026-10-16.v1';
export interface Signup {locale?:Locale;cardId?:string; firstName: string; email: string; marketingConsent: boolean; policyVersion: string; botToken: string; website: string }
export interface Reading { meaning: string; guidance: string; question: string; source: 'ai'|'demo' }
export type DeliveryStatus='requested'|'generating'|'generated'|'mocked'|'provider_accepted'|'generation_failed'|'email_failed'|'delivered'|'bounced';
export interface ReadingRequest {locale?:Locale; id:string; firstName:string; email:string; marketingConsent:boolean; policyVersion:string; card:Card; createdAt:string; status:DeliveryStatus; reading?:Reading; providerId?:string; consentTokenHash?:string }
export interface Admission { kind:'accepted'|'duplicate'|'limited'; id?:string }
export interface Store {
 admit(request:ReadingRequest, ipHash:string):Promise<Admission>;
 update(id:string, patch:{status:DeliveryStatus;reading?:Reading;providerId?:string}):Promise<void>;
}
export interface EmailMessage { purpose?:'free_reading'|'commerce'; to:string; subject:string; html:string; text:string; requestId:string }
export interface EmailProvider { send(message:EmailMessage):Promise<{id:string;status:'mocked'|'provider_accepted'}> }
export interface Generator { generate(card:Card,locale?:Locale):Promise<Reading> }
export class PublicError extends Error { status:number; constructor(status:number, message:string){ super(message); this.status=status; } }
export function parseSignup(value:unknown): Signup {
 if(!value||typeof value!=='object')throw new PublicError(400,'Completează prenumele și adresa de email.');
 const v=value as Record<string,unknown>;
 const firstName=typeof v.firstName==='string'?v.firstName.trim().normalize('NFC'):'';
 const email=typeof v.email==='string'?v.email.trim().toLowerCase():'';
 if(!/^[\p{L}\p{M}][\p{L}\p{M} '\u2019-]{0,59}$/u.test(firstName))throw new PublicError(400,'Introdu un prenume valid (maximum 60 de caractere).');
 if(email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)||email.split('@')[0].length>64||email.startsWith('.')||email.includes('..'))throw new PublicError(400,'Introdu o adresă de email validă.');
 if(typeof v.marketingConsent!=='boolean'||v.policyVersion!==POLICY_VERSION)throw new PublicError(400,'Reîncarcă formularul și verifică opțiunea de consimțământ.');
 if(typeof v.website!=='string'||typeof v.botToken!=='string'||v.botToken.length>4096||v.website.length>200)throw new PublicError(400,'Formular invalid.');
 if(v.locale!==undefined&&!isLocale(v.locale))throw new PublicError(400,'Limba selectată nu este validă.');
 if(v.cardId!==undefined&&(typeof v.cardId!=='string'||!DECK.some(c=>c.id===v.cardId)))throw new PublicError(400,'Cartea selectată nu este validă.');
 return {...(isLocale(v.locale)?{locale:v.locale}:{}),...(typeof v.cardId==='string'?{cardId:v.cardId}:{}),firstName,email,marketingConsent:v.marketingConsent,policyVersion:POLICY_VERSION,botToken:v.botToken,website:v.website};
}
