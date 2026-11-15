import {supabaseProjectUrl} from '../lib/journal/config.ts';
// Read-only configuration/connectivity checks. No messages, accounts, charges or posts are created.
import {emailRequirements} from '../lib/launch/config.ts';
import {freeReadingEmailRequirements} from '../lib/tarot/free-email.ts';
import {LIVE_COMMERCE_AUTHORIZED,LIVE_CUSTOMER_EMAIL_AUTHORIZED} from '../lib/commerce/safety.ts';
let failed=0;
function check(name,ready){console.log(`${ready?'PASS':'MISSING'} ${name}`);if(!ready)failed++;}
const env=process.env;
check('Live paid commerce remains disabled',LIVE_COMMERCE_AUTHORIZED===false);
check('Live commercial email remains disabled',LIVE_CUSTOMER_EMAIL_AUTHORIZED===false);
for(const [name,ready] of [...emailRequirements(env),...freeReadingEmailRequirements(env)])check(name,ready);
check('TAROT_EMAIL_MODE=live',env.TAROT_EMAIL_MODE==='live');
for(const name of ['JOURNAL_DATABASE_READY','PUBLIC_PLATFORM_DATABASE_READY'])check(`${name}=true`,env[name]==='true');
check('NEXT_PUBLIC_SUPABASE_ANON_KEY',!!env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
check('Server Supabase URL is a project base URL',!!env.SUPABASE_URL&&supabaseProjectUrl(env.SUPABASE_URL)===env.SUPABASE_URL.replace(/\/$/,''));
check('Server and public Supabase projects match',!!env.SUPABASE_URL&&supabaseProjectUrl(env.NEXT_PUBLIC_SUPABASE_URL??env.SUPABASE_URL)===supabaseProjectUrl(env.SUPABASE_URL));
if(failed){console.log('Live setup is incomplete. Only setting names are shown; no secrets were printed.');process.exitCode=1;}
else{
 async function read(url,headers={}){try{const result=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});if(!result.ok)return {status:result.status};return {status:result.status,data:await result.json()};}catch{return {status:0};}}
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
 for(const [table,column] of [['tarot_profiles','id'],['tarot_journal_entries','id'],['tarot_card_notes','card_id'],['commerce_orders','locale']]){
  const result=await read(`${env.SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=0`,headers);
  check(`Database schema: ${table}`,result.status===200);
 }
 const settings=await read(`${env.SUPABASE_URL}/auth/v1/settings`,{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY});
 check('Auth email confirmation is required',settings.status===200&&settings.data?.mailer_autoconfirm===false);
 check('Google sign-in is enabled',settings.data?.external?.google===true);
 const senders=await read('https://api.brevo.com/v3/senders',{'api-key':env.BREVO_API_KEY});
 check('Configured Brevo sender is active',senders.status===200&&senders.data?.senders?.some(sender=>sender.email?.toLowerCase()===env.BREVO_SENDER_EMAIL.toLowerCase()&&sender.active===true));
 const session=await read(`${env.TAROT_SITE_URL}/api/account/session`);
 check('Deployed customer accounts are configured',session.status===200&&session.data?.configured===true&&session.data?.user===null);
 console.log('These checks do not prove inbox delivery, Google approval, password reset or account deletion. Complete the live test-account journeys before launch.');
 process.exitCode=failed?1:0;
}
