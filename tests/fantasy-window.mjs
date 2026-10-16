import assert from "node:assert/strict";
import fs from "node:fs";
import {
  fantasySeasonReady,
  fantasySeasonWindow,
  previousWeek,
  weekKey,
  eligibleFantasyGames,
} from "../src/fantasy-scoring.js";
export async function testFantasyWindow(db) {
  await db.exec(`alter table public.fantasy_leagues add column owner_id uuid,add column team_limit int default 6,add column draft_started_at timestamptz;
 create table public.fantasy_memberships(league_id uuid,user_id uuid);
 alter table public.fantasy_week_lineups add column league_id uuid,add column user_id uuid,add column week_start date,add column slot text;
 create unique index fantasy_window_lineup_pk on public.fantasy_week_lineups(league_id,user_id,week_start,player_id);
 create function public.fantasy_week_start(at_time timestamptz) returns date language sql stable as $$select (at_time at time zone 'America/New_York')::date-extract(dow from at_time at time zone 'America/New_York')::int$$;
 create function league_private.is_fantasy_member(target_league uuid) returns boolean language sql stable as $$select exists(select 1 from public.fantasy_memberships where league_id=target_league and user_id=auth.uid())$$;`);
  const migration = fs
    .readdirSync("supabase/migrations")
    .find((p) => p.endsWith("ssl_fantasy_season_window.sql"));
  await db.exec(fs.readFileSync("supabase/migrations/" + migration, "utf8"));
  const row = (
      await db.query(
        "select * from league_private.ssl_season_states order by number desc limit 1",
      )
    ).rows[0],
    sid = row.id,
    teams = row.state.teams;
  const catalog = (
      await db.query("select id from league_private.ssl_catalog order by id")
    ).rows.map((p) => p.id),
    rosters = Object.fromEntries(
      teams.map((t, i) => [t.id, catalog.slice(i * 11, i * 11 + 11)]),
    );
  const current = (
    await db.query("select public.fantasy_week_start(now()) w")
  ).rows[0].w
    .toISOString()
    .slice(0, 10);
  let st = {
    ...row.state,
    status: "drafting",
    teams,
    rosters,
    games: [],
    finalStandings: [],
    weekOne: previousWeek(current, 9),
  };
  const save = async () =>
    db.query(
      "update league_private.ssl_season_states set state=$1 where id=$2",
      [JSON.stringify(st), sid],
    );
  const fail = async (fn) => {
    let e;
    try {
      await fn();
    } catch (err) {
      e = err;
    }
    assert(e, "Expected fantasy season gate rejection");
  };
  const insert = async () =>
    (
      await db.query(
        "insert into public.fantasy_leagues(id,state,owner_id) values(gen_random_uuid(),'waiting',auth.uid()) returning *",
      )
    ).rows[0];
  await save();
  await fail(insert);
  st.status = "postdraft";
  st.rosters[teams[0].id] = rosters[teams[0].id].slice(0, 10);
  await save();
  await fail(insert);
  st.rosters[teams[0].id] = catalog.slice(0, 11);
  await save();
  const league = await insert();
  assert.equal(league.ssl_season_id, sid);
  st.status = "drafting";
  await save();
  await fail(() =>
    db.query("update public.fantasy_leagues set state='drafting' where id=$1", [
      league.id,
    ]),
  );
  st.status = "regular";
  await save();
  await db.query(
    "update public.fantasy_leagues set state='drafting' where id=$1",
    [league.id],
  );
  await db.query(
    "insert into public.fantasy_memberships values($1,auth.uid())",
    [league.id],
  );
  await db.query(
    "insert into public.fantasy_draft_picks(league_id,pick_number,user_id,player_id) select $1,i,auth.uid(),$2::int[] [i] from generate_series(1,10) i".replace(
      "$2::int[] [i]",
      "($2::int[])[i]",
    ),
    [league.id, catalog.slice(0, 10)],
  );
  await db.query(
    "update public.fantasy_leagues set state='active' where id=$1",
    [league.id],
  );
  const active = (
    await db.query("select * from public.fantasy_leagues where id=$1", [
      league.id,
    ])
  ).rows[0];
  assert(active.activated_at);
  assert.equal(active.first_week.toISOString().slice(0, 10), current);
  await db.query("select league_private.ensure_fantasy_week($1)", [league.id]);
  const weeks = (
    await db.query(
      "select distinct week_start from public.fantasy_week_lineups where league_id=$1",
      [league.id],
    )
  ).rows;
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].week_start.toISOString().slice(0, 10), current);
  let window = fantasySeasonWindow(
    { ...active, first_week: current },
    { ...st, id: sid },
    new Date(),
  );
  assert.equal(window.weeks.length, 13);
  assert.equal(window.firstWeek, current);
  const activeLeague = { ...active, ssl_season_id: sid, first_week: current },
    activated = new Date(active.activated_at).getTime();
  const sample = [
    {
      id: "before",
      seasonId: sid,
      phase: "regular",
      startsAt: new Date(activated - 1000).toISOString(),
    },
    {
      id: "regular",
      seasonId: sid,
      phase: "regular",
      startsAt: new Date(activated + 1000).toISOString(),
    },
    {
      id: "playoffs",
      seasonId: sid,
      phase: "playoffs",
      startsAt: new Date(activated + 1000).toISOString(),
    },
    {
      id: "other",
      seasonId: "other",
      phase: "regular",
      startsAt: new Date(activated + 1000).toISOString(),
    },
  ];
  assert.deepEqual(
    eligibleFantasyGames(activeLeague, st, sample).map((g) => g.id),
    ["regular"],
  );
  assert(fantasySeasonReady(st));
  assert(!fantasySeasonReady({ ...st, status: "drafting" }));
  // A league active before opening day receives all 22 weeks.
  st.weekOne = previousWeek(current, -1);
  await save();
  const preseason = await insert();
  await db.query(
    "update public.fantasy_leagues set state='active' where id=$1",
    [preseason.id],
  );
  const pre = (
    await db.query("select * from public.fantasy_leagues where id=$1", [
      preseason.id,
    ])
  ).rows[0];
  window = fantasySeasonWindow({ ...pre, first_week: st.weekOne }, st);
  assert.equal(window.weeks.length, 22);
  // Regular-season close prevents new leagues, starts, and later lineup swaps.
  st.weekOne = previousWeek(current, 22);
  await save();
  await fail(insert);
  await fail(() =>
    db.query("select league_private.swap_fantasy_lineup($1,$2,$3)", [
      league.id,
      catalog[0],
      catalog[7],
    ]),
  );
  assert(!fantasySeasonReady(st));
  st.status = "postseason";
  st.weekOne = previousWeek(current, 9);
  await save();
  await fail(insert);
  console.log(
    "PASS: fantasy creation/start gates, full-roster check, SSL binding, 22-week and midseason windows, no earlier-week lineups, and postseason closure.",
  );
}
