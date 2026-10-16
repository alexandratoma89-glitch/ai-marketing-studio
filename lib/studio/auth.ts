export async function authorized(header:string|null,username:string|undefined,password:string|undefined):Promise<boolean>{
 if(!username||username.includes(':')||!password||password.length<24||!header?.startsWith('Basic ')||header.length>4096)return false;
 let supplied:string;
 try{supplied=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(header.slice(6)),c=>c.charCodeAt(0)));}catch{return false;}
 const encoder=new TextEncoder();
 const [a,b]=await Promise.all([supplied,`${username}:${password}`].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0;
}
export function credentialsReady(username:string|undefined,password:string|undefined){return !!username&&!username.includes(':')&&!!password&&password.length>=24;}
