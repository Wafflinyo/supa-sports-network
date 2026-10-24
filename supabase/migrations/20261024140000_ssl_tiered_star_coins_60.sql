-- Tiered per-player Star Coins. Game-based cooldowns may be bypassed at 2 coins per missing game.
-- Existing locked-game charges remain immutable; future reservations are re-priced from prior games.
create or replace function league_private.ssl_star_tiers() returns jsonb
language sql stable set search_path='' as $$
  select coalesce(jsonb_object_agg(p.id::text,
    case
      when p.name in ('Bowser','Donkey Kong','Petey Piranha','King K Rool','King Boo','Funky Kong','Boom Boom','King Bob-omb','Wario')
        or p.name ~* '(^| )Kritter$' or p.name ~* '(^| )Bro$' then 3
      when p.name in ('Mario','Morton','Roy','Flower Fields Monty')
        or p.name ~* '(^| )Pianta$' or p.name ~* 'Dry Bones$' then 2
      else 1
    end
  ), '{}'::jsonb) from league_private.ssl_catalog p
$$;
revoke all on function league_private.ssl_star_tiers() from public, anon, authenticated;

create or replace function league_private.ssl_star_view(st jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare
  balances jsonb:='{}'; recharge jsonb:='{}'; info jsonb:='{}'; sim jsonb;
  tiers jsonb:=league_private.ssl_star_tiers();
  g jsonb; t jsonb; m jsonb; p jsonb; sel jsonb; players jsonb;
  costs jsonb; need jsonb; remaining_by_player jsonb; price_by_player jsonb; b jsonb;
  cost integer; price integer; tier integer; remaining integer; next_remaining integer;
  tid text; pid text; expired boolean;
begin
  expired:=st->>'champion' is not null or exists(
    select 1 from jsonb_array_elements(coalesce(st->'playoffSeries','[]')) x
    where x->>'round'='final' and x->>'winner' is not null
  );
  for t in select value from jsonb_array_elements(coalesce(st->'teams','[]')) loop
    balances:=jsonb_set(balances,array[t->>'id'],
      '{"allocation":60,"transfers":0,"spent":0,"reserved":0,"available":60}'::jsonb);
  end loop;
  for m in select value from jsonb_array_elements(coalesce(st->'starTransfers','[]')) loop
    for tid in select unnest(array[m->>'from',m->>'to']) loop
      b:=balances->tid;
      b:=jsonb_set(b,'{transfers}',to_jsonb((b->>'transfers')::int
        + case when tid=m->>'from' then -(m->>'quantity')::int else (m->>'quantity')::int end));
      balances:=jsonb_set(balances,array[tid],b);
    end loop;
  end loop;

  -- Locked/recorded games use their original immutable charges, but cooldowns
  -- are reconstructed from their actual starred players and participating rosters.
  for g in select value from jsonb_array_elements(coalesce(st->'games','[]'))
    where value ? 'starRecord' and value->>'stage'<>'cancelled'
    order by (value->'starRecord'->>'sequence')::int loop
    for tid in select unnest(array[g->>'away',g->>'home']) loop
      m:=g->'starRecord'->'teams'->tid;
      sel:=coalesce(m->'selected','[]'::jsonb);
      cost:=coalesce((m->>'cost')::int,0);
      b:=balances->tid;
      b:=jsonb_set(b,'{spent}',to_jsonb((b->>'spent')::int+cost));
      balances:=jsonb_set(balances,array[tid],b);
      for p in select value from jsonb_array_elements(coalesce(g->'frozenRosters'->tid,'[]')) loop
        pid:=p#>>'{}';
        tier:=coalesce((tiers->>pid)::int,1);
        remaining:=coalesce((recharge->>pid)::int,0);
        next_remaining:=case when sel @> jsonb_build_array(p) then tier-1
                            else greatest(remaining-1,0) end;
        recharge:=jsonb_set(recharge,array[pid],to_jsonb(next_remaining));
      end loop;
      info:=jsonb_set(info,array[g->>'id'],
        coalesce(info->(g->>'id'),'{}'::jsonb)
        || jsonb_build_object(tid,m||'{"status":"spent"}'::jsonb));
    end loop;
  end loop;

  -- Project future, unlocked games chronologically so editing earlier lineups
  -- immediately recalculates every later reservation, cooldown and bypass cost.
  sim:=recharge;
  for g in select value from jsonb_array_elements(coalesce(st->'games','[]'))
    where not value ? 'starRecord' and value->>'stage' in ('scheduled','live')
    order by (value->>'startsAt')::timestamptz,value->>'id' loop
    for tid in select unnest(array[g->>'away',g->>'home']) loop
      sel:=coalesce(g->'starRequests'->tid,'[]'::jsonb);
      players:=league_private.ssl_roster(st,tid);
      need:='[]'::jsonb; costs:='{}'::jsonb;
      remaining_by_player:='{}'::jsonb; price_by_player:='{}'::jsonb;
      cost:=0;
      for p in select value from jsonb_array_elements(players) loop
        pid:=p#>>'{}';
        tier:=coalesce((tiers->>pid)::int,1);
        remaining:=coalesce((sim->>pid)::int,0);
        price:=tier+2*remaining;
        remaining_by_player:=jsonb_set(remaining_by_player,array[pid],to_jsonb(remaining));
        price_by_player:=jsonb_set(price_by_player,array[pid],to_jsonb(price));
        if remaining>0 then need:=need||jsonb_build_array(p); end if;
        if sel @> jsonb_build_array(p) then
          cost:=cost+price;
          costs:=jsonb_set(costs,array[pid],to_jsonb(price));
          next_remaining:=tier-1;
        else
          next_remaining:=greatest(remaining-1,0);
        end if;
        sim:=jsonb_set(sim,array[pid],to_jsonb(next_remaining));
      end loop;
      b:=balances->tid;
      b:=jsonb_set(b,'{reserved}',to_jsonb((b->>'reserved')::int+cost));
      balances:=jsonb_set(balances,array[tid],b);
      info:=jsonb_set(info,array[g->>'id'],
        coalesce(info->(g->>'id'),'{}'::jsonb)||
        jsonb_build_object(tid,jsonb_build_object(
          'selected',sel,'cost',cost,'byPlayer',costs,
          'remainingByPlayer',remaining_by_player,'priceByPlayer',price_by_player,
          'recharging',need,'status','reserved')));
    end loop;
  end loop;
  for tid,b in select * from jsonb_each(balances) loop
    b:=b||jsonb_build_object('available',
      case when expired then 0 else 60+(b->>'transfers')::int-(b->>'spent')::int-(b->>'reserved')::int end,
      'expired',expired);
    balances:=jsonb_set(balances,array[tid],b);
  end loop;
  return jsonb_build_object('balances',balances,'games',info,'recharging',recharge,'expired',expired);
end
$$;
revoke all on function league_private.ssl_star_view(jsonb) from public, anon, authenticated;
