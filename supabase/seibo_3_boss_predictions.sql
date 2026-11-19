begin;

alter table public.seibo_3_predictions
  add column if not exists boss_id text,
  alter column shot_type drop not null,
  drop constraint if exists seibo_3_predictions_gimmicks_check,
  drop constraint if exists seibo_3_predictions_character_ids_check,
  drop constraint if exists seibo_3_predictions_entry_check;

alter table public.seibo_3_predictions
  add constraint seibo_3_predictions_entry_check check (
    (shot_type is not null and cardinality(gimmicks) between 1 and 4
      and cardinality(character_ids) between 1 and 4)
    or (boss_id is not null and shot_type is null
      and cardinality(gimmicks) = 0 and cardinality(character_ids) = 0)
  );

grant select (boss_id) on public.seibo_3_predictions to anon, authenticated;

create or replace function public.replace_seibo_3_submission_with_bosses(
  p_token_hash text,
  p_batch_id text,
  p_predictions jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('seibo_3:' || p_token_hash, 0)
  );

  delete from public.seibo_3_predictions where token_hash = p_token_hash;

  insert into public.seibo_3_predictions (
    token_hash, batch_id, quest_key, shot_type, gimmicks, character_ids, boss_id
  )
  select p_token_hash, p_batch_id, quest_key, shot_type, gimmicks, character_ids, boss_id
  from pg_catalog.jsonb_to_recordset(p_predictions)
    as prediction(quest_key text, shot_type text, gimmicks text[], character_ids text[], boss_id text);
end;
$$;

revoke all on function public.replace_seibo_3_submission_with_bosses(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_seibo_3_submission_with_bosses(text, text, jsonb) to service_role;

commit;
