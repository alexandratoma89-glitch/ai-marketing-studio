-- Expand owner-uploaded clips to 2 minutes 30 seconds; preserve all existing videos.
begin;
alter table public.own_videos drop constraint if exists own_videos_duration_check;
alter table public.own_videos add constraint own_videos_duration_check check (duration between 5 and 150);
commit;
