-- Enforce prospective SSL character (11-14) and next-season pick (>=9)
-- limits when submitting, revising and approving a multi-franchise trade.
-- Existing offers, acceptances and rosters are not modified by this migration.

create or replace function league_private.ssl_validate_trade_limits(
  target_season uuid, participating_teams jsonb, transfers jsonb
) returns void language plpgsql security invoker set search_path to '' as $limits$
declare
  season_no integer;
  st jsonb;
  pick_season integer;
  member text;
  member_name text;
  row jsonb;
  kind text;
  source_team text;
  destination_team text;
  player_id integer;
  actual_owner text;
  roster_size integer;
  pick_count integer;
  asset_key text;
  seen_assets text[] := array[]::text[];
  violations text[] := array[]::text[];
begin
  select s.number,s.state into season_no,st
    from league_private.ssl_season_states s where s.id=target_season;
  if st is null then raise exception 'Trade season not found';end if;
  if jsonb_typeof(participating_teams) is distinct from 'array'
     or jsonb_array_length(participating_teams) not between 2 and 12
     or jsonb_typeof(transfers) is distinct from 'array'
     or jsonb_array_length(transfers) not between 1 and 50 then
    raise exception 'A trade requires 2-12 teams and 1-50 assets';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(participating_teams) t(team)
    where not exists(select 1 from jsonb_array_elements(st->'teams') s
                     where s->>'id'=t.team)
  ) then raise exception 'The proposal contains a team outside the league';end if;
  if (select count(distinct t.team) from jsonb_array_elements_text(participating_teams) t(team))
      <>jsonb_array_length(participating_teams) then
    raise exception 'The proposal contains duplicate teams';
  end if;
  pick_season:=case when coalesce((st->>'offseasonTrading')::boolean,false)
    then season_no else season_no+1 end;

  for row in select value from jsonb_array_elements(transfers) loop
    kind:=row->>'kind';
    source_team:=row->>'from';
    destination_team:=row->>'to';
    if source_team is null or destination_team is null
       or source_team=destination_team
       or not participating_teams @> jsonb_build_array(source_team)
       or not participating_teams @> jsonb_build_array(destination_team) then
      raise exception 'Each trade asset must move between two participating teams';
    end if;
    if kind in ('player','pick') then
      if nullif(row->>'id','') is null then
        raise exception 'Each player or pick must have a valid asset ID';
      end if;
      asset_key:=kind||':'||(row->>'id');
      if asset_key=any(seen_assets) then
        raise exception 'A player or pick appears more than once in the offer';
      end if;
      seen_assets:=array_append(seen_assets,asset_key);
      if kind='player' then
        if (row->>'id') !~ '^[0-9]+$' then
          raise exception 'A selected player ID is invalid';
        end if;
        player_id:=(row->>'id')::integer;
        if not league_private.ssl_roster(st,source_team)
             @> jsonb_build_array(player_id) then
          select coalesce(t.value->>'name',source_team) into member_name
            from jsonb_array_elements(st->'teams') t(value)
            where t.value->>'id'=source_team;
          raise exception '% no longer owns the offered player %',
            coalesce(member_name,source_team),player_id;
        end if;
      else
        select p.owner::text into actual_owner
          from league_private.ssl_pick_assets p
          where p.id=(row->>'id')::uuid and p.season_number=pick_season;
        if actual_owner is distinct from source_team then
          select coalesce(t.value->>'name',source_team) into member_name
            from jsonb_array_elements(st->'teams') t(value)
            where t.value->>'id'=source_team;
          raise exception '% no longer owns the selected next-season draft pick',
            coalesce(member_name,source_team);
        end if;
      end if;
    elsif kind not in ('coin','contract') then
      raise exception 'Unknown trade asset type';
    end if;
  end loop;

  for member in select value from jsonb_array_elements_text(participating_teams) loop
    select t.value->>'name' into member_name
      from jsonb_array_elements(st->'teams') t(value)
      where t.value->>'id'=member;
    member_name:=coalesce(member_name,member);
    roster_size:=jsonb_array_length(league_private.ssl_roster(st,member));
    select count(*) into pick_count from league_private.ssl_pick_assets p
      where p.owner=member::uuid and p.season_number=pick_season;
    for row in select value from jsonb_array_elements(transfers) loop
      if row->>'kind'='player' then
        if row->>'from'=member then roster_size:=roster_size-1;end if;
        if row->>'to'=member then roster_size:=roster_size+1;end if;
      elsif row->>'kind'='pick' then
        if row->>'from'=member then pick_count:=pick_count-1;end if;
        if row->>'to'=member then pick_count:=pick_count+1;end if;
      end if;
    end loop;
    if roster_size<11 then
      violations:=array_append(violations,format(
        '%s would have %s characters (minimum 11)',member_name,roster_size));
    elsif roster_size>14 then
      violations:=array_append(violations,format(
        '%s would have %s characters (maximum 14)',member_name,roster_size));
    end if;
    if pick_count<9 then
      violations:=array_append(violations,format(
        '%s would have %s tradable next-season picks (minimum 9)',member_name,pick_count));
    end if;
  end loop;
  if cardinality(violations)>0 then
    raise exception 'Trade violates league limits: %',array_to_string(violations,'; ');
  end if;
end $limits$;

revoke all on function league_private.ssl_validate_trade_limits(uuid,jsonb,jsonb)
  from public,anon,authenticated;

do $patch$
declare
  src text;
  submit_anchor text := 'insert into league_private.ssl_offers(id,season,body,accepted)';
  approve_anchor text := 'if jsonb_array_length(offer.accepted)<>jsonb_array_length(offer.body->''teams'') then raise exception ''Every participating team must accept first'';end if;';
  edit_anchor text := 'note:=left(coalesce(payload->>''note'',''''),1000);';
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='league_private' and p.proname='ssl_manage_core';
  if src is null or strpos(src,submit_anchor)=0 or strpos(src,approve_anchor)=0 then
    raise exception 'SSL core trade submission/approval code changed; manual review required';
  end if;
  src:=replace(src,submit_anchor,
    'perform league_private.ssl_validate_trade_limits(target,payload->''teams'',payload->''moves'');' ||
    chr(10) || ' ' || submit_anchor);
  src:=replace(src,approve_anchor,approve_anchor||chr(10)||
    ' perform league_private.ssl_validate_trade_limits(target,offer.body->''teams'',offer.body->''moves'');');
  execute src;

  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='league_private' and p.proname='ssl_trade_manage';
  if src is null or strpos(src,edit_anchor)=0 then
    raise exception 'SSL trade-revision code changed; manual review required';
  end if;
  src:=replace(src,edit_anchor,
    'perform league_private.ssl_validate_trade_limits(target,o.body->''teams'',payload->''moves'');' ||
    chr(10) || ' ' || edit_anchor);
  execute src;
end $patch$;