export type VideoStatus = 'review' | 'approved' | 'scheduled';
export interface Video { id: number; title: string; category: string; time: string; date: string; platforms: string[]; status: VideoStatus; art: string; duration: string }
export function approveVideo(video: Video): Video { return {...video, status: 'approved'}; }
export function scheduleVideo(video: Video): Video { if(video.status !== 'approved') throw new Error('Videoclipul trebuie aprobat înainte de programare.'); return {...video, status: 'scheduled'}; }
// Implement these adapters only when providers and credentials are explicitly configured.
export interface VideoGenerator { generate(input: {prompt: string; language: 'ro'; captions: boolean}): Promise<{url: string}> }
export interface Publisher { publish(video: Video): Promise<{externalId: string}> }
export async function publishApproved(video: Video, publisher: Publisher) { if(video.status !== 'approved' && video.status !== 'scheduled') throw new Error('Aprobarea este obligatorie.'); return publisher.publish(video); }
export const sampleVideos: Video[] = [
{id:1,title:'Ce mesaj are universul pentru tine?',category:'TAROT ZILNIC',time:'09:00',date:'2026-10-15',platforms:['Instagram','TikTok'],status:'review',art:'moon',duration:'0:32'},
{id:2,title:'O nouă etapă începe cu tine',category:'ENERGIE & INTENȚIE',time:'18:00',date:'2026-10-15',platforms:['Facebook','YouTube'],status:'approved',art:'sun',duration:'0:28'},
{id:3,title:'Alege cartea care te cheamă',category:'ALEGE O CARTE',time:'09:00',date:'2026-10-16',platforms:['Instagram','TikTok'],status:'scheduled',art:'cards',duration:'0:35'},
{id:4,title:'Eliberează ce nu îți mai servește',category:'RITUAL DE SEARĂ',time:'18:00',date:'2026-10-16',platforms:['Facebook','YouTube'],status:'review',art:'night',duration:'0:30'}];
