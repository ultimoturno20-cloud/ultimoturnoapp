begin;

-- The finish is written in the card name ("Amarys [Reverse]"); align variants whose finish field disagrees.
-- Same rules as finishFromName() in packages/db/src/index.ts.
with derived as (
  select v.id, v.business_id, v.product_id, v.language, v.condition, v.grading_company, v.grade,
    case
      when tags ~ 'cosmo' then 'cosmos holo'
      when tags ~ 'reverse' then 'reverse holo'
      when tags ~ 'master ?ball' then 'master ball'
      when tags ~ 'pok[eé] ?ball' then 'poke ball'
      when tags ~ 'holo' then 'holo'
    end as finish
  from card_variants v
  join card_products p on p.id = v.product_id
  cross join lateral (
    select lower(coalesce(string_agg(m[1], ' '), '')) as tags
    from regexp_matches(p.name, '([[(][^])]*[])])', 'g') as m
  ) t
)
update card_variants v
set finish = d.finish
from derived d
where v.id = d.id
  and d.finish is not null
  and v.finish <> d.finish
  and not exists (
    select 1 from card_variants other
    where other.business_id = d.business_id and other.product_id = d.product_id
      and other.language = d.language and other.condition = d.condition and other.finish = d.finish
      and coalesce(other.grading_company, '') = coalesce(d.grading_company, '')
      and coalesce(other.grade, '') = coalesce(d.grade, '')
  );

commit;
