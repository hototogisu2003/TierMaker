-- Run in the Supabase SQL Editor, then import assist_characters.csv.
create table if not exists public.assist_characters (
  number integer primary key,
  name text not null check (length(trim(name)) > 0),
  file_path text not null,
  assist_skill text not null check (length(trim(assist_skill)) > 0),
  ratio numeric,
  attack_up smallint not null default 0 check (attack_up in (0, 1)),
  friendship_up smallint not null default 0 check (friendship_up in (0, 1)),
  hp_up smallint not null default 0 check (hp_up in (0, 1)),
  ss_shortening smallint not null default 0 check (ss_shortening in (0, 1)),
  damage_reduction smallint not null default 0 check (damage_reduction in (0, 1)),
  recovery smallint not null default 0 check (recovery in (0, 1)),
  barrier_grant smallint not null default 0 check (barrier_grant in (0, 1)),
  status_grant smallint not null default 0 check (status_grant in (0, 1))
);

alter table public.assist_characters enable row level security;
grant usage on schema public to anon, authenticated;
revoke all on public.assist_characters from anon, authenticated;
grant select on public.assist_characters to anon, authenticated;

drop policy if exists assist_characters_public_read on public.assist_characters;
create policy assist_characters_public_read
  on public.assist_characters for select to anon, authenticated
  using (true);
