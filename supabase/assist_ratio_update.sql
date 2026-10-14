-- Source: idea/assist_1.xlsx (87 characters, 45 non-null ratios).
-- Run this entire file in the Supabase SQL Editor.
-- Only ratio is updated; names, images, descriptions and classifications are preserved.
-- Excel blank cells become NULL. Values such as 106 are used without conversion.
-- Safe to run again. All 87 source numbers must already exist in the target table.

begin;

alter table public.assist_characters
  add column if not exists ratio numeric;

create temporary table assist_ratio_source (
  number integer primary key,
  ratio numeric
) on commit drop;

insert into pg_temp.assist_ratio_source (number, ratio) values
  (7321, 5),
  (7322, 106),
  (7323, NULL),
  (7367, NULL),
  (7368, NULL),
  (7385, NULL),
  (7438, 50),
  (7481, NULL),
  (7482, NULL),
  (7487, NULL),
  (7590, NULL),
  (7606, 10),
  (7685, NULL),
  (7767, NULL),
  (7771, 2),
  (7772, 20),
  (7792, NULL),
  (7857, 20),
  (7888, 10),
  (7918, 15),
  (7992, NULL),
  (7993, 20),
  (7997, NULL),
  (8003, NULL),
  (8004, 10),
  (8014, 20),
  (8082, NULL),
  (8147, NULL),
  (8180, 20),
  (8197, NULL),
  (8198, NULL),
  (8204, 10),
  (8248, 6),
  (8283, 20),
  (8337, 15),
  (8339, NULL),
  (8418, 25),
  (8455, NULL),
  (8487, NULL),
  (8524, NULL),
  (8530, NULL),
  (8531, NULL),
  (8555, 25),
  (8573, 10),
  (8575, 20),
  (8625, 10),
  (8658, NULL),
  (8659, 25),
  (8684, 25),
  (8717, 15),
  (8724, NULL),
  (8725, NULL),
  (8737, NULL),
  (8826, NULL),
  (8862, 15),
  (8889, 20),
  (8921, 107),
  (8928, 33),
  (8929, NULL),
  (8937, NULL),
  (8983, NULL),
  (9004, 25),
  (9005, NULL),
  (9065, 105),
  (9071, NULL),
  (9099, 25),
  (9162, 25),
  (9167, 30),
  (9194, NULL),
  (9200, 30),
  (9203, NULL),
  (9204, 25),
  (9232, 25),
  (9297, 25),
  (9308, NULL),
  (9309, NULL),
  (9310, 30),
  (9342, 20),
  (9344, 25),
  (9373, NULL),
  (9375, NULL),
  (9376, 30),
  (9402, 10),
  (9438, 33),
  (9491, 28),
  (9492, NULL),
  (9504, NULL);

-- Abort the whole transaction, including the column addition, if records are missing.
do $$
declare
  missing_numbers text;
begin
  select string_agg(source.number::text, ', ' order by source.number)
    into missing_numbers
  from pg_temp.assist_ratio_source as source
  left join public.assist_characters as target on target.number = source.number
  where target.number is null;

  if missing_numbers is not null then
    raise exception 'Missing character numbers in assist_characters: %. Import the existing character data first.', missing_numbers;
  end if;
end;
$$;

update public.assist_characters as target
set ratio = source.ratio
from pg_temp.assist_ratio_source as source
where target.number = source.number
  and target.ratio is distinct from source.ratio;

-- Expected: source_characters=87, matched_characters=87,
--           characters_with_ratio=45, mismatched_ratios=0.
select
  count(*) as source_characters,
  count(target.number) as matched_characters,
  count(target.ratio) as characters_with_ratio,
  count(*) filter (where target.ratio is distinct from source.ratio) as mismatched_ratios
from pg_temp.assist_ratio_source as source
left join public.assist_characters as target on target.number = source.number;

commit;

-- Preview the resulting numeric order (ties use number descending).
select number, name, ratio
from public.assist_characters
where attack_up = 1
order by ratio desc nulls last, number desc;
