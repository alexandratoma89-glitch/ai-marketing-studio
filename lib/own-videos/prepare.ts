import {MAX_VIDEO_BYTES,type MediaMime} from './policy';
export type PreparedMedia={file:File;type:MediaMime;duration:number;width:number;height:number;kind:'photo'|'video'};
const photoPattern=/\.(jpe?g|png|heic|heif)$/i;
function image(blob:Blob):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Nu am putut citi fotografia. Încearcă exportul JPEG din Poze.'));};img.src=url;});}
export async function prepareMedia(original:File):Promise<PreparedMedia>{
 if(!original.size||original.size>MAX_VIDEO_BYTES)throw new Error('Alege un fișier de maximum 150 MB.');
 const photo=photoPattern.test(original.name)||['image/jpeg','image/png','image/heic','image/heif'].includes(original.type);
 if(photo){
  let source:Blob=original,img:HTMLImageElement;
  try{img=await image(source);}catch(error){if(!/\.(heic|heif)$/i.test(original.name)&&!['image/heic','image/heif'].includes(original.type))throw error;try{const {default:convert}=await import('heic2any');const decoded=await convert({blob:original,toType:'image/jpeg',quality:.95});source=Array.isArray(decoded)?decoded[0]:decoded;img=await image(source);}catch{throw new Error('Conversia HEIC nu a reușit. Exportă fotografia ca JPEG din aplicația Poze.');}}
  if(!img.naturalWidth||!img.naturalHeight)throw new Error('Fotografie invalidă.');
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Browserul nu poate pregăti fotografia.');ctx.fillStyle='#000';ctx.fillRect(0,0,1080,1350);const scale=Math.min(1080/img.naturalWidth,1350/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(1080-w)/2,(1350-h)/2,w,h);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Conversia fotografiei nu a reușit.')),'image/jpeg',.92));
  if(blob.size>8*1024*1024)throw new Error('Fotografia pregătită depășește 8 MB.');
  return {file:new File([blob],original.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}),type:'image/jpeg',duration:0,width:1080,height:1350,kind:'photo'};
 }
 const type:MediaMime=original.type==='video/quicktime'||/\.mov$/i.test(original.name)?'video/quicktime':'video/mp4';
 if(!/\.(mp4|mov)$/i.test(original.name)&&!['video/mp4','video/quicktime'].includes(original.type))throw new Error('Alege MP4, MOV, JPEG, PNG sau HEIC.');
 const file=new File([original],original.name,{type}),url=URL.createObjectURL(file);
 try{const meta=await new Promise<{duration:number;width:number;height:number}>((resolve,reject)=>{const video=document.createElement('video');const timer=setTimeout(()=>{video.src='';reject(new Error('Citirea videoclipului a durat prea mult.'));},30000);video.preload='metadata';video.onloadedmetadata=()=>{clearTimeout(timer);resolve({duration:video.duration,width:video.videoWidth,height:video.videoHeight});};video.onerror=()=>{clearTimeout(timer);reject(new Error('Browserul nu poate citi acest MOV/MP4. Încearcă Safari sau exportă H.264 din Poze.'));};video.src=url;});return {file,type,...meta,kind:'video'};}finally{URL.revokeObjectURL(url);}
}
