create table if not exists public.seibo_predictions (
  id bigint generated always as identity primary key,
  batch_id text not null,
  quest_key text not null,
  shot_type text not null,
  gimmicks text[] not null default '{}',
  character_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint seibo_predictions_quest_key_check check (
    quest_key in ('nigimitama', 'tougenkyo', 'cocytus', 'largamente', 'melangcolin', 'ex')
  ),
  constraint seibo_predictions_shot_type_check check (
    shot_type in (
      U&'\53CD\5C04',
      U&'\8CAB\901A',
      U&'\53CD/\8CAB'
    )
  ),
  constraint seibo_predictions_gimmicks_length_check check (
    cardinality(gimmicks) between 1 and 4
  ),
  constraint seibo_predictions_character_ids_length_check check (
    cardinality(character_ids) between 1 and 4
  )
);

create index if not exists seibo_predictions_quest_key_idx
  on public.seibo_predictions (quest_key, created_at desc);

alter table public.seibo_predictions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'seibo_predictions'
      and policyname = 'seibo_predictions_select_all'
  ) then
    create policy seibo_predictions_select_all
      on public.seibo_predictions
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'seibo_predictions'
      and policyname = 'seibo_predictions_insert_all'
  ) then
    create policy seibo_predictions_insert_all
      on public.seibo_predictions
      for insert
      with check (true);
  end if;
end $$;

create table if not exists public.seibo_submission_locks (
  token_hash text primary key,
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.claim_seibo_submission_slot(
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

  insert into public.seibo_submission_locks (token_hash, last_submitted_at)
  values (p_token_hash, v_now)
  on conflict do nothing;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'next_allowed_at', null
    );
  end if;

  select last_submitted_at
    into v_last_submitted_at
    from public.seibo_submission_locks
   where token_hash = p_token_hash
   for update;

  if v_last_submitted_at is null then
    update public.seibo_submission_locks
       set last_submitted_at = v_now
     where token_hash = p_token_hash;

    return jsonb_build_object(
      'allowed', true,
      'next_allowed_at', null
    );
  end if;

  if v_last_submitted_at <= v_now - make_interval(hours => v_cooldown_hours) then
    update public.seibo_submission_locks
       set last_submitted_at = v_now
     where token_hash = p_token_hash;

    return jsonb_build_object(
      'allowed', true,
      'next_allowed_at', null
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'next_allowed_at', v_last_submitted_at + make_interval(hours => v_cooldown_hours)
  );
end;
$$;

create or replace function public.release_seibo_submission_slot(
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

  delete from public.seibo_submission_locks
   where token_hash = p_token_hash;
end;
$$;

alter table public.seibo_submission_locks enable row level security;

grant execute on function public.claim_seibo_submission_slot(text, integer) to anon, authenticated;
grant execute on function public.release_seibo_submission_slot(text) to anon, authenticated;
