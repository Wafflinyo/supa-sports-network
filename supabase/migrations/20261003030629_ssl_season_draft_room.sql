begin;
create table public.ssl_draft_seasons (
 id uuid primary key default gen_random_uuid(), name text not null unique check(char_length(name) between 2 and 60),
 teams jsonb not null, rounds integer not null check(rounds between 1 and 20), snake boolean not null default true,
 draft_order jsonb not null default '[]', picks jsonb not null default '[]',
 stage text not null default 'lottery' check(stage in ('lottery','ready','drafting','complete')),
 created_at timestamptz not null default now()
);
alter table public.ssl_draft_seasons enable row level security;
revoke all on public.ssl_draft_seasons from anon, authenticated;
grant select on public.ssl_draft_seasons to anon, authenticated;
create policy "Public seasonal draft board" on public.ssl_draft_seasons for select to anon, authenticated using(true);
create table league_private.ssl_lottery_order (season_id uuid primary key references public.ssl_draft_seasons(id) on delete cascade, draw_order jsonb not null);
alter table league_private.ssl_lottery_order enable row level security;
revoke all on league_private.ssl_lottery_order from public, anon, authenticated;

create function league_private.create_ssl_season(season_name text, team_entries jsonb, draft_rounds integer, snake_order boolean)
returns public.ssl_draft_seasons language plpgsql security definer set search_path='' as $$
declare result public.ssl_draft_seasons; entry jsonb; lottery jsonb; total integer;
begin
 if auth.uid() is null or (league_private.current_access()->>'role') is distinct from 'commissioner' then raise exception 'Commissioner access required'; end if;
 if jsonb_typeof(team_entries) is distinct from 'array' then raise exception 'Supply a team list'; end if;
 total:=jsonb_array_length(team_entries);
 if total not between 2 and 16 or draft_rounds is null or draft_rounds not between 1 and 20 or total*draft_rounds>138 then raise exception 'Use 2–16 teams and rounds within the 138-player pool'; end if;
 for entry in select value from jsonb_array_elements(team_entries) loop
  if jsonb_typeof(entry) is distinct from 'object' or coalesce(char_length(trim(entry->>'name')),0) not between 2 and 80 or coalesce(char_length(entry->>'id'),0) not between 1 and 40 then raise exception 'Each team needs an ID and name'; end if;
  if coalesce(entry->>'logo','')<>'' and ((entry->>'logo') !~ '^https://' or char_length(entry->>'logo')>500) then raise exception 'Logo URLs must use HTTPS'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(team_entries))<>total or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(team_entries))<>total then raise exception 'Teams must be unique'; end if;
 insert into public.ssl_draft_seasons(name,teams,rounds,snake) values(trim(season_name),team_entries,draft_rounds,coalesce(snake_order,true)) returning * into result;
 select jsonb_agg(value order by draw) into lottery from (select value,random() draw from jsonb_array_elements(team_entries)) shuffled;
 insert into league_private.ssl_lottery_order values(result.id,lottery);
 return result;
end $$;
create function public.create_ssl_season(season_name text, team_entries jsonb, draft_rounds integer, snake_order boolean)
returns public.ssl_draft_seasons language sql security invoker set search_path='' as $$ select league_private.create_ssl_season(season_name,team_entries,draft_rounds,snake_order); $$;
revoke all on function public.create_ssl_season(text,jsonb,integer,boolean), league_private.create_ssl_season(text,jsonb,integer,boolean) from public,anon;
grant execute on function public.create_ssl_season(text,jsonb,integer,boolean), league_private.create_ssl_season(text,jsonb,integer,boolean) to authenticated;

create function league_private.ssl_draft_action(season uuid, operation text, player integer default null)
returns public.ssl_draft_seasons language plpgsql security definer set search_path='' as $$
declare result public.ssl_draft_seasons; lottery jsonb; count_teams integer; pick_no integer; round_no integer; slot integer;
begin
 if auth.uid() is null or (league_private.current_access()->>'role') is distinct from 'commissioner' then raise exception 'Commissioner access required'; end if;
 select * into result from public.ssl_draft_seasons where id=season for update;
 if not found then raise exception 'Season not found'; end if;
 count_teams:=jsonb_array_length(result.teams);
 if operation='draw' then
  if result.stage<>'lottery' then raise exception 'Lottery is already finished'; end if;
  select draw_order into lottery from league_private.ssl_lottery_order where season_id=season;
  result.draft_order:=result.draft_order || jsonb_build_array(lottery->jsonb_array_length(result.draft_order));
  if jsonb_array_length(result.draft_order)=count_teams then result.stage:='ready'; end if;
 elsif operation='start' then
  if result.stage<>'ready' then raise exception 'Finish the lottery first'; end if;
  result.stage:='drafting';
 elsif operation='pick' then
  if result.stage<>'drafting' then raise exception 'Draft is not open'; end if;
  if player is null or player not between 1 and 138 then raise exception 'Unknown player'; end if;
  if exists(select 1 from jsonb_array_elements(result.picks) p where (p->>'player')::integer=player) then raise exception 'Player already drafted'; end if;
  pick_no:=jsonb_array_length(result.picks); round_no:=pick_no/count_teams;
  slot:=case when result.snake and round_no%2=1 then count_teams-1-(pick_no%count_teams) else pick_no%count_teams end;
  result.picks:=result.picks || jsonb_build_array(jsonb_build_object('number',pick_no+1,'round',round_no+1,'team',result.draft_order->slot->>'id','player',player));
  if jsonb_array_length(result.picks)=count_teams*result.rounds then result.stage:='complete'; end if;
 else raise exception 'Unknown draft action';
 end if;
 update public.ssl_draft_seasons set draft_order=result.draft_order,picks=result.picks,stage=result.stage where id=season;
 return result;
end $$;
create function public.ssl_draft_action(season uuid, operation text, player integer default null)
returns public.ssl_draft_seasons language sql security invoker set search_path='' as $$ select league_private.ssl_draft_action(season,operation,player); $$;
revoke all on function public.ssl_draft_action(uuid,text,integer),league_private.ssl_draft_action(uuid,text,integer) from public,anon;
grant execute on function public.ssl_draft_action(uuid,text,integer),league_private.ssl_draft_action(uuid,text,integer) to authenticated;
commit;
