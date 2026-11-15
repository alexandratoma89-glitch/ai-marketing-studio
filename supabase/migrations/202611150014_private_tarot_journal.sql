-- New public customer accounts. Existing Studio, commerce and publishing remain separate.
begin;
create table public.tarot_profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=60),
 locale text not null default 'en' check(locale in('en','ro')),
 updated_at timestamptz not null default now()
);
create table public.tarot_journal_entries(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 card_id text not null check(card_id in('thefool','themagician','thehighpriestess','theempress','theemperor','thehierophant','TheLovers','thechariot','thestrength','thehermit','wheeloffortune','justice','thehangedman','death','temperance','thedevil','thetower','thestar','themoon','thesun','judgement','theworld','aceofwands','twoofwands','threeofwands','fourofwands','fiveofwands','sixofwands','sevenofwands','eightofwands','nineofwands','tenofwands','pageofwands','knightofwands','queenofwands','kingofwands','aceofcups','twoofcups','threeofcups','fourofcups','fiveofcups','sixofcups','sevenofcups','eightofcups','nineofcups','tenofcups','pageofcups','knightofcups','queenofcups','kingofcups','aceofswords','twoofswords','threeofswords','fourofswords','fiveofswords','sixofswords','sevenofswords','eightofswords','nineofswords','tenofswords','pageofswords','knightofswords','queenofswords','kingofswords','aceofpentacles','twoofpentacles','threeofpentacles','fourofpentacles','fiveofpentacles','sixofpentacles','sevenofpentacles','eightofpentacles','nineofpentacles','tenofpentacles','pageofpentacles','knightofpentacles','queenofpentacles','kingofpentacles')),
 entry_date date not null default current_date,
 orientation text not null check(orientation in('upright','reversed')),
 title text not null check(length(title) between 1 and 120),
 question text not null default '' check(length(question)<=1000),
 interpretation text not null default '' check(length(interpretation)<=4000),
 reflection text not null default '' check(length(reflection)<=4000),
 search_text text generated always as (lower(title||' '||question||' '||interpretation||' '||reflection)) stored,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.tarot_card_notes(
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 card_id text not null check(card_id in('thefool','themagician','thehighpriestess','theempress','theemperor','thehierophant','TheLovers','thechariot','thestrength','thehermit','wheeloffortune','justice','thehangedman','death','temperance','thedevil','thetower','thestar','themoon','thesun','judgement','theworld','aceofwands','twoofwands','threeofwands','fourofwands','fiveofwands','sixofwands','sevenofwands','eightofwands','nineofwands','tenofwands','pageofwands','knightofwands','queenofwands','kingofwands','aceofcups','twoofcups','threeofcups','fourofcups','fiveofcups','sixofcups','sevenofcups','eightofcups','nineofcups','tenofcups','pageofcups','knightofcups','queenofcups','kingofcups','aceofswords','twoofswords','threeofswords','fourofswords','fiveofswords','sixofswords','sevenofswords','eightofswords','nineofswords','tenofswords','pageofswords','knightofswords','queenofswords','kingofswords','aceofpentacles','twoofpentacles','threeofpentacles','fourofpentacles','fiveofpentacles','sixofpentacles','sevenofpentacles','eightofpentacles','nineofpentacles','tenofpentacles','pageofpentacles','knightofpentacles','queenofpentacles','kingofpentacles')),
 notes text not null default '' check(length(notes)<=6000),studied boolean not null default false,
 updated_at timestamptz not null default now(),primary key(user_id,card_id)
);
alter table public.tarot_profiles enable row level security;
alter table public.tarot_journal_entries enable row level security;
alter table public.tarot_card_notes enable row level security;
revoke all on public.tarot_profiles,public.tarot_journal_entries,public.tarot_card_notes from anon,authenticated;
grant select,insert,update,delete on public.tarot_profiles,public.tarot_journal_entries,public.tarot_card_notes to authenticated;
create policy profile_owner on public.tarot_profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy journal_owner on public.tarot_journal_entries for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy card_notes_owner on public.tarot_card_notes for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index tarot_journal_owner_date on public.tarot_journal_entries(user_id,entry_date desc,created_at desc,id);
create index tarot_notes_owner_studied on public.tarot_card_notes(user_id,studied);
commit;
