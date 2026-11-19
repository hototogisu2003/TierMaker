begin;

create table if not exists public.seibo_3_predictions (
  id bigint generated always as identity primary key,
  token_hash text not null,
  batch_id text not null,
  quest_key text not null check (
    quest_key in ('nigimitama', 'tougenkyo', 'cocytus', 'largamente', 'melangcolin')
  ),
  shot_type text not null check (
    shot_type in (U&'\53CD\5C04', U&'\8CAB\901A', U&'\53CD/\8CAB')
  ),
  gimmicks text[] not null check (cardinality(gimmicks) between 1 and 4),
  character_ids text[] not null check (cardinality(character_ids) between 1 and 4),
  created_at timestamptz not null default now(),
  unique (token_hash, quest_key)
);

alter table public.seibo_3_predictions enable row level security;

revoke all on public.seibo_3_predictions from public, anon, authenticated;
revoke all on sequence public.seibo_3_predictions_id_seq from public, anon, authenticated;
grant select (quest_key, shot_type, gimmicks, character_ids)
  on public.seibo_3_predictions to anon, authenticated;
grant select, insert, delete on public.seibo_3_predictions to service_role;
grant usage on sequence public.seibo_3_predictions_id_seq to service_role;

drop policy if exists seibo_3_predictions_select on public.seibo_3_predictions;
create policy seibo_3_predictions_select on public.seibo_3_predictions
  for select to anon, authenticated using (true);

create or replace function public.replace_seibo_3_submission(
  p_token_hash text,
  p_batch_id text,
  p_predictions jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Serialize replacements from the same device until the transaction ends.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('seibo_3:' || p_token_hash, 0)
  );

  delete from public.seibo_3_predictions where token_hash = p_token_hash;

  insert into public.seibo_3_predictions (
    token_hash, batch_id, quest_key, shot_type, gimmicks, character_ids
  )
  select p_token_hash, p_batch_id, quest_key, shot_type, gimmicks, character_ids
  from pg_catalog.jsonb_to_recordset(p_predictions)
    as prediction(quest_key text, shot_type text, gimmicks text[], character_ids text[]);
end;
$$;

revoke all on function public.replace_seibo_3_submission(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_seibo_3_submission(text, text, jsonb) to service_role;

commit;
