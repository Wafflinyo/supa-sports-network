
-- Conference POTW is commissioner-selected; retire the obsolete voting API.
revoke all on function public.ssl_potw_manage(uuid,integer,text,jsonb,timestamptz,integer)
 from public,anon,authenticated;
revoke all on function public.ssl_potw_vote(uuid,integer,integer)
 from public,anon,authenticated;
create or replace function public.ssl_potw_read(target_season uuid)
returns jsonb language sql stable set search_path to '' as $$
  select league_private.ssl_conference_potw_read(target_season);
$$;
revoke all on function public.ssl_potw_read(uuid) from public,anon,authenticated;
grant execute on function public.ssl_potw_read(uuid) to anon,authenticated;
