-- Commissioner-only voter audit for All-Star and awards ballots.
-- Never return private voter identity or franchise associations to public viewers.
-- A voter account may lack a GM connection; this remains a valid ballot but
-- is not treated as proof that a franchise GM has submitted.
create or replace function league_private.ssl_commissioner_ballot_voters(target_season uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or
     coalesce(league_private.current_access()->>'role','') <> 'commissioner'
  then
    raise exception 'Commissioner access required';
  end if;

  if not exists (
    select 1 from league_private.ssl_season_states where id = target_season
  ) then
    raise exception 'Season not found';
  end if;

  select coalesce(jsonb_object_agg(t.kind,t.voters),'{}'::jsonb)
  into result
  from (
    select b.kind,
           jsonb_agg(
             jsonb_build_object(
               'username',coalesce(p.username,'Unknown account'),
               'teamId',linked.franchise_id,
               'updatedAt',b.updated_at
             )
             order by b.updated_at desc
           ) as voters
    from league_private.ssl_ballots b
    left join public.league_profiles p on p.user_id=b.voter
    left join lateral (
      select f.id::text as franchise_id
      from league_private.access_audit a
      join league_private.ssl_franchises f on f.slot=a.slot
      where a.actor=b.voter
        and a.action='code_login'
        and a.slot > 0
        and a.created_at <= b.updated_at
      order by a.created_at desc
      limit 1
    ) linked on true
    where b.season=target_season
    group by b.kind
  ) t;
  return result;
end $$;

revoke all on function league_private.ssl_commissioner_ballot_voters(uuid)
from public,anon,authenticated;
grant execute on function league_private.ssl_commissioner_ballot_voters(uuid)
to authenticated;

create or replace function public.ssl_commissioner_ballot_voters(target_season uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select league_private.ssl_commissioner_ballot_voters(target_season);
$$;

revoke all on function public.ssl_commissioner_ballot_voters(uuid)
from public,anon,authenticated;
grant execute on function public.ssl_commissioner_ballot_voters(uuid)
to authenticated;
