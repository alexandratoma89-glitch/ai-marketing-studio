-- iPhone MOV videos and JPEG photos converted locally by the owner's browser.
begin;
alter table public.own_videos add column kind text not null default 'video' check(kind in('video','photo'));
alter table public.own_videos add column mime text not null default 'video/mp4';
alter table public.own_videos drop constraint own_videos_check;
alter table public.own_videos drop constraint own_videos_duration_check;
alter table public.own_videos add constraint own_media_format_check check(
 (kind='video' and mime in('video/mp4','video/quicktime') and duration between 5 and 150 and width>=360 and height>=640 and width::numeric/height between 0.5 and 0.65)
 or(kind='photo' and mime='image/jpeg' and duration=0 and bytes<=8388608 and width=1080 and height=1350));
alter table public.own_videos add constraint own_media_path_check check(path=id::text||case mime when 'image/jpeg' then '/photo.jpg' when 'video/quicktime' then '/video.mov' else '/video.mp4' end);
alter function public.own_video_command(text,jsonb) rename to own_media_command_v2;
create function public.own_video_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;asset public.own_videos;
begin
 if p_action='upload' then
  insert into public.own_videos(id,path,bytes,duration,width,height,title,caption,kind,mime) values((p_data->>'id')::uuid,p_data->>'path',(p_data->>'bytes')::integer,(p_data->>'duration')::numeric,(p_data->>'width')::integer,(p_data->>'height')::integer,p_data->>'title',p_data->>'caption',coalesce(p_data->>'kind','video'),coalesce(p_data->>'mime','video/mp4'));return '{}';
 elsif p_action='approve' then
  select * into asset from public.own_videos where id=(p_data->>'id')::uuid for update;
  if asset.kind='photo' and p_data->'providers' ? 'youtube' then raise exception 'YouTube requires video';end if;
 end if;
 result:=public.own_media_command_v2(p_action,p_data);
 if p_action in('claim','reconcile_claim') and result is not null then
  select * into asset from public.own_videos where id=(result->>'video_id')::uuid;
  result:=result||jsonb_build_object('kind',asset.kind,'mime',asset.mime);
 end if;
 return result;
end $$;
revoke all on function public.own_video_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.own_video_command(text,jsonb) to service_role;
commit;
