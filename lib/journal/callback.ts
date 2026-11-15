export function callbackCredentials(params:URLSearchParams){
 const code=params.get('code'),token=params.get('token_hash'),type=params.get('type');
 if(code&&!token&&code.length<=4096)return {kind:'code' as const,code};
 if(!code&&token&&/^[a-f0-9]{32,128}$/i.test(token)&&(type==='signup'||type==='recovery'))return {kind:'email' as const,token_hash:token,type};
 throw new Error('invalid_callback');
}
