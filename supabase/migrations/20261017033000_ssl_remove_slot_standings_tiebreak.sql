-- Official SSL standings tiebreakers: winning percentage, run differential,
-- then fewer runs allowed. Franchise slot is NOT a standings tiebreaker.
-- Exact ties on all three criteria have no additional official tiebreaker yet.
create or replace function league_private.ssl_rankings(st jsonb)
returns jsonb language sql immutable set search_path='' as $$
 with teams as (
   select t->>'id' id from jsonb_array_elements(st->'teams') t
 ), results as (
   select t.id,
    coalesce(avg(case when (g->'result'->'scores'->>t.id)::int >
      (g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int
      then 1.0 else 0.0 end) filter(where g->>'stage'='final'),0) pct,
    coalesce(sum((g->'result'->'scores'->>t.id)::int -
      (g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int)
      filter(where g->>'stage'='final'),0) diff,
    coalesce(sum((g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int)
      filter(where g->>'stage'='final'),0) allowed
   from teams t
   left join lateral jsonb_array_elements(st->'games') g
     on g->>'phase'='regular' and t.id in(g->>'away',g->>'home')
   group by t.id
 ), ranked as (
   select id,
    row_number() over (order by pct desc,diff desc,allowed asc) rank,
    count(*) over (partition by pct,diff,allowed)>1 as exact_tie
   from results
 )
 select coalesce(jsonb_agg(
   jsonb_build_object('id',id,'rank',rank,'exactTie',exact_tie) order by rank
 ),'[]'::jsonb) from ranked
$$;
revoke all on function league_private.ssl_rankings(jsonb) from public,anon,authenticated;
