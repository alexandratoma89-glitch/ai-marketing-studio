export const WELCOME_POLICY='welcome-2026-10-29.v1';
export const validEmail=(v:string)=>v.length<=254&&v.split('@')[0]?.length<=64&&!v.startsWith('.')&&!v.includes('..')&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(v);
