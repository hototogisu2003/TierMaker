begin;

create or replace function public.bingo_13th_has_unique_ids(p_values text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select cardinality(p_values) = (
    select count(distinct value)::integer from unnest(p_values) as value
  );
$$;

create table if not exists public.bingo_13th_predictions (
  id bigint generated always as identity primary key,
  token_hash text not null unique,
  character_ids text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bingo_13th_ids_length check (cardinality(character_ids) = 9),
  constraint bingo_13th_ids_unique check (public.bingo_13th_has_unique_ids(character_ids))
);

create or replace function public.set_bingo_13th_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bingo_13th_set_updated_at on public.bingo_13th_predictions;
create trigger bingo_13th_set_updated_at
  before update on public.bingo_13th_predictions
  for each row execute function public.set_bingo_13th_updated_at();

alter table public.bingo_13th_predictions enable row level security;
grant usage on schema public to anon, authenticated, service_role;
revoke all on public.bingo_13th_predictions from public, anon, authenticated;
revoke all on sequence public.bingo_13th_predictions_id_seq from public, anon, authenticated;
grant select (character_ids) on public.bingo_13th_predictions to anon, authenticated;
grant all on public.bingo_13th_predictions to service_role;
grant usage, select on sequence public.bingo_13th_predictions_id_seq to service_role;

drop policy if exists bingo_13th_select on public.bingo_13th_predictions;
create policy bingo_13th_select on public.bingo_13th_predictions
  for select to anon, authenticated using (true);

commit;
