import {productionStore} from '../tarot/runtime.ts';
import type {MarketingDb} from './service.ts';
export function marketingDb():MarketingDb{
 if(process.env.MARKETING_DATABASE_READY!=='true')throw new Error('marketing_database_not_ready');
 const store=productionStore();return {command:<T>(action:string,data:Record<string,unknown>={})=>store.rpc<T>('marketing_command',{p_action:action,p_data:data})};
}
