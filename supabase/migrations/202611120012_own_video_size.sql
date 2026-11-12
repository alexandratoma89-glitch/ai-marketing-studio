-- Allow owner uploads up to 150 MiB; retain existing clips.
begin;
alter table public.own_videos drop constraint if exists own_videos_bytes_check;
alter table public.own_videos add constraint own_videos_bytes_check check(bytes between 32 and 157286400);
commit;
