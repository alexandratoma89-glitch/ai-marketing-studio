import {isDemo,siteUrl,verifyTurnstile} from '../tarot/runtime.ts';
import {HttpError} from './http.ts';
import {BrevoEmailProvider} from '../tarot/brevo.ts';
import {DemoGenerator} from '../tarot/providers.ts';
export function assertTestCommerce(){if(process.env.COMMERCE_MODE!=='test')throw new HttpError(503,'Rezervările sunt disponibile doar după configurarea modului de test.');}
export function botVerifier(){return isDemo()?async(token:string)=>token==='development-only':verifyTurnstile;}
export function tokenSecret(){const secret=process.env.COMMERCE_TOKEN_SECRET;if(!secret||secret.length<32)throw new Error('Management token signing key missing');return secret;}
export function jobDeps(){assertTestCommerce();return {email:new BrevoEmailProvider('mock'),generator:new DemoGenerator(),origin:siteUrl(),tokenSecret:tokenSecret()};}
