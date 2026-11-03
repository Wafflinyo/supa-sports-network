-- The six Round 1 box scores below were already publicly published as
-- src/preseason-game-records.json. Mirror ONLY those public results into the
-- tournament result table so rounds 2-4 can be released via the new RPC.
-- Never import the commissioner's still-private Round 2/semifinal/final files.
with historical(match_key,team_a_name,team_b_name,score_a,score_b) as
 (values
 ('R1-1','TWILIGHT TOWN TANKS','New Donk City Fuggetaboudits',7,8),
 ('R1-2','Diamond City Checkers','Petalburg Pangolins',12,6),
 ('R1-3','Rogueport Ruffians','Decalburg Dedennes',4,0),
 ('R1-4','Delfino Dolphins','New Donk City Knights',5,4),
 ('R1-5','Starborn Voidstriders','HopeDogo Retrievers 3',3,8),
 ('R1-6','Petalburg Petilils','Moleville Haliban',6,5)
 ), season as (
 select id,state from league_private.ssl_season_states
 where number=1 and name='Season 1' limit 1
 ), checked as (
 select s.id as season_id,h.*,pair.team_a,pair.team_b,
  (select t->>'name' from jsonb_array_elements(s.state->'teams') t
    where t->>'id'=pair.team_a::text) as found_a,
  (select t->>'name' from jsonb_array_elements(s.state->'teams') t
    where t->>'id'=pair.team_b::text) as found_b
 from historical h cross join season s
 cross join lateral jsonb_to_record(
   league_private.ssl_preseason_pair(s.id,h.match_key)
 ) as pair(team_a uuid,team_b uuid)
 )
insert into public.ssl_preseason_results
  (season_id,match_key,team_a,team_b,score_a,score_b)
select season_id,match_key,team_a,team_b,score_a,score_b
from checked
where lower(found_a)=lower(team_a_name)
  and lower(found_b)=lower(team_b_name)
on conflict (season_id,match_key) do nothing;
