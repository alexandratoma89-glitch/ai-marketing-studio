import {isDemo,productionStore} from '../tarot/runtime.ts';
export interface WelcomeDb {command<T=any>(action:string,data?:Record<string,unknown>):Promise<T>}
let local:Promise<WelcomeDb>|undefined;
export async function welcomeDb():Promise<WelcomeDb>{
 if(!isDemo()){if(process.env.WELCOME_DATABASE_READY!=='true')throw new Error('welcome_database_missing');return {command:(action,data={})=>productionStore().rpc('welcome_command',{p_action:action,p_data:data})};}
 return local??=(async()=>{const {PGlite}=await import('@electric-sql/pglite');const {readFile}=await import('node:fs/promises');const sql=new PGlite();await sql.exec('create role anon;create role authenticated;create role service_role;');await sql.exec(await readFile('supabase/migrations/202610290007_welcome_email.sql','utf8'));return {async command<T>(action:string,data:Record<string,unknown>={}){return (await sql.query<{r:T}>('select welcome_command($1,$2::jsonb) r',[action,JSON.stringify(data)])).rows[0].r;}};})();
}
