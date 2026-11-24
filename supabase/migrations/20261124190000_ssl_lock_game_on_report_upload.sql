-- A completed game's sheet does not need pregame lineup validation.
do $migration$
declare
  definition text := pg_catalog.pg_get_functiondef('league_private.ssl_manage_before_stars(text,uuid,jsonb)'::regprocedure);
  old_step text := $old$if g->>'stage'='scheduled' then perform league_private.ssl_manage_core('start_game',target,jsonb_build_object('game',g->>'id'));end if;$old$;
  new_step text := $new$if g->>'stage'='scheduled' then
    if a->>'role'<>'commissioner' then raise exception 'Commissioner access required';end if;
    if st->>'status' not in ('regular','postseason') then
     raise exception 'Start the season first, and choose an unplayed game';
    end if;
    -- The result validator still checks players against the rosters at upload.
    g:=g||jsonb_build_object(
     'stage','live',
     'frozenRosters',jsonb_build_object(
      g->>'away',league_private.ssl_roster(st,g->>'away'),
      g->>'home',league_private.ssl_roster(st,g->>'home')
     )
    );
    update league_private.ssl_season_states
     set state=jsonb_set(state,array['games',idx::text],g)
     where id=target;
   end if;$new$;
begin
  if strpos(definition,old_step)=0 then
    if strpos(definition,new_step)>0 then return;end if;
    raise exception 'Could not locate the scheduled report upload step';
  end if;
  execute replace(definition,old_step,new_step);
end
$migration$;
