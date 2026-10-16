import {commerceDb} from '@/lib/commerce/db';import {assertTestCommerce} from '@/lib/commerce/runtime';import {apiError,noStore} from '@/lib/commerce/http';
export async function GET(){try{assertTestCommerce();return Response.json({slots:await (await commerceDb()).command('slots'),testMode:true},{headers:noStore});}catch(error){return apiError(error);}}
