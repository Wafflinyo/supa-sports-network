-- Repair public Season 1 schedule publishing without altering draft, picks, games,
-- lineup selections or existing dates. Undated matchups must not be sent to
-- fantasy_player_schedule, whose starts_at column is NOT NULL.
-- Preserve current deployed functions and change only their broken sync path.
DO $migration$
DECLARE
  core_src text;
  calendar_src text;
  old_core text := $oldcore$if g->>'stage'='cancelled' or not (st->>'schedulePublished')::boolean then continue;end if;$oldcore$;
  new_core text := $newcore$if g->>'stage'='cancelled' or g->>'startsAt' is null or not (st->>'schedulePublished')::boolean then continue;end if;$newcore$;
  old_calendar text := $oldcal$  st:=jsonb_set(st,array['games',i::text],g);
  update league_private.ssl_season_states set state=st where id=target;$oldcal$;
  new_calendar text := $newcal$  st:=jsonb_set(st,array['games',i::text],g);
  -- Only games with actual kickoff times enter the fantasy lock schedule.
  -- Previously published undated games become active when the commissioner
  -- adds a date. Subsequent date edits keep the existing lock in sync.
  if coalesce((st->>'schedulePublished')::boolean,false) then
   delete from public.fantasy_player_schedule where game_key='ssl:'||(g->>'id');
   insert into public.fantasy_player_schedule(game_key,player_id,starts_at)
   select 'ssl:'||(g->>'id'), p.player_id::integer, deadline
   from unnest(array[g->>'away',g->>'home']) as sides(team_id)
   cross join lateral jsonb_array_elements_text(league_private.ssl_roster(st,sides.team_id)) as p(player_id)
   on conflict (game_key,player_id) do update set starts_at=excluded.starts_at;
  end if;
  update league_private.ssl_season_states set state=st where id=target;$newcal$;
BEGIN
  core_src:=pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
  if strpos(core_src,old_core)=0 then raise exception 'Unexpected manage_core implementation: aborting schedule-fix migration';end if;
  execute replace(core_src,old_core,new_core);

  calendar_src:=pg_get_functiondef('league_private.ssl_manage_calendar(text,uuid,jsonb)'::regprocedure);
  if strpos(calendar_src,old_calendar)=0 then raise exception 'Unexpected manage_calendar implementation: aborting schedule-fix migration';end if;
  execute replace(calendar_src,old_calendar,new_calendar);
END
$migration$;
