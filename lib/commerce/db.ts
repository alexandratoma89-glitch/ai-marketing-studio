import type {CommerceDb} from './types.ts';
import {productionStore,isDemo} from '../tarot/runtime.ts';
const state=globalThis as typeof globalThis & {commerceDb?:Promise<CommerceDb & {rpc:<T>(name:string,params:Record<string,unknown>)=>Promise<T>} >};
export async function commerceDb():Promise<CommerceDb>{
 if(!isDemo()){
  if(process.env.COMMERCE_DATABASE_READY!=='true')throw new Error('Commerce migration not configured');
  const store=productionStore();return {command:<T>(action:string,data:Record<string,unknown>={})=>store.rpc<T>('commerce_command',{p_action:action,p_data:data})};
 }
 if(!state.commerceDb)state.commerceDb=(async()=>{const {PGlite}=await import('@electric-sql/pglite');const {readFile}=await import('node:fs/promises');const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');for(const name of ['202610160001_free_tarot.sql','202610160002_commerce.sql'])await db.exec(await readFile(`${process.cwd()}/supabase/migrations/${name}`,'utf8'));return {async rpc<T>(name:string,params:Record<string,unknown>){const names:Record<string,string[]>={request_free_tarot:['p_id','p_first_name','p_email','p_marketing_consent','p_policy_version','p_card','p_ip_hash','p_token_hash'],update_free_tarot:['p_id','p_status','p_reading','p_provider_id'],tarot_marketing_choice:['p_token_hash','p_action'],record_tarot_delivery:['p_event_id','p_provider_id','p_type','p_occurred_at']};if(!Object.prototype.hasOwnProperty.call(names,name))throw new Error('Unsupported RPC');const keys=names[name],r=await db.query<{result:T}>(`select ${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) as result`,keys.map(key=>typeof params[key]==='object'&&params[key]!==null?JSON.stringify(params[key]):params[key]));return r.rows[0].result;},async command<T>(action:string,data:Record<string,unknown>={}){const result=await db.query<{result:T}>('select commerce_command($1,$2::jsonb) as result',[action,JSON.stringify(data)]);return result.rows[0].result;}};})();
 return state.commerceDb;
}

export async function devTarotRpc<T>(name:string,params:Record<string,unknown>){if(!isDemo())throw new Error('Development storage is unavailable in production');await commerceDb();return (await state.commerceDb!).rpc<T>(name,params);}
