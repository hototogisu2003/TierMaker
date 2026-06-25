create or replace function public.has_unique_text_array(p_values text[])
returns boolean
language sql
immutable
as $$
  select cardinality(p_values) = (
    select count(distinct value)::integer
    from unnest(p_values) as value
  );
$$;

create table if not exists public.bingo_predictions (
  id bigint generated always as identity primary key,
  token_hash text not null,
  character_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bingo_predictions_character_ids_length_check check (
    cardinality(character_ids) = 9
  ),
  constraint bingo_predictions_character_ids_unique_check check (
    public.has_unique_text_array(character_ids)
  )
);

create unique index if not exists bingo_predictions_token_hash_idx
  on public.bingo_predictions (token_hash);

create index if not exists bingo_predictions_updated_at_idx
  on public.bingo_predictions (updated_at desc);

create or replace function public.set_bingo_predictions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bingo_predictions_set_updated_at on public.bingo_predictions;
create trigger bingo_predictions_set_updated_at
  before update on public.bingo_predictions
  for each row
  execute function public.set_bingo_predictions_updated_at();

alter table public.bingo_predictions enable row level security;

grant usage on schema public to anon, authenticated;
revoke insert, update, delete on public.bingo_predictions from anon, authenticated;
revoke usage, select on sequence public.bingo_predictions_id_seq from anon, authenticated;
grant select on public.bingo_predictions to anon, authenticated;

drop policy if exists bingo_predictions_insert_all on public.bingo_predictions;
drop policy if exists bingo_predictions_update_all on public.bingo_predictions;
drop policy if exists bingo_predictions_delete_all on public.bingo_predictions;
drop policy if exists bingo_predictions_select_all on public.bingo_predictions;

create policy bingo_predictions_select_all
  on public.bingo_predictions
  for select
  using (true);

create table if not exists public.bingo_submission_locks (
  token_hash text primary key,
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.claim_bingo_submission_slot(
  p_token_hash text,
  p_cooldown_hours integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_last_submitted_at timestamptz;
  v_cooldown_hours integer := greatest(coalesce(p_cooldown_hours, 12), 1);
begin
  if p_token_hash is null or btrim(p_token_hash) = '' then
    raise exception 'token hash is required';
  end if;

  insert into public.bingo_submission_locks (token_hash, last_submitted_at)
  values (p_token_hash, v_now)
  on conflict do nothing;

  if found then
    return jsonb_build_object('allowed', true, 'next_allowed_at', null);
  end if;

  select last_submitted_at
    into v_last_submitted_at
    from public.bingo_submission_locks
   where token_hash = p_token_hash
   for update;

  if v_last_submitted_at is null or v_last_submitted_at <= v_now - make_interval(hours => v_cooldown_hours) then
    update public.bingo_submission_locks
       set last_submitted_at = v_now
     where token_hash = p_token_hash;

    return jsonb_build_object('allowed', true, 'next_allowed_at', null);
  end if;

  return jsonb_build_object(
    'allowed', false,
    'next_allowed_at', v_last_submitted_at + make_interval(hours => v_cooldown_hours)
  );
end;
$$;

create or replace function public.release_bingo_submission_slot(
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token_hash is null or btrim(p_token_hash) = '' then
    return;
  end if;

  delete from public.bingo_submission_locks
   where token_hash = p_token_hash;
end;
$$;

alter table public.bingo_submission_locks enable row level security;

grant execute on function public.claim_bingo_submission_slot(text, integer) to anon, authenticated;
grant execute on function public.release_bingo_submission_slot(text) to anon, authenticated;
