import {HttpError,noStore} from '../commerce/http.ts';
export const response=(data:unknown,status=200)=>Response.json(data,{status,headers:noStore});
export function journalError(error:unknown){if(error instanceof HttpError)return response({code:error.status===403?'forbidden':'invalid_input'},error.status);const code=error instanceof Error?error.message:'';return response({code:['sign_in_required','invalid_input','not_configured','invalid_credentials','bot_failed','email_not_confirmed'].includes(code)?code:'service_unavailable'},code==='sign_in_required'?401:code==='invalid_input'?400:503);}
