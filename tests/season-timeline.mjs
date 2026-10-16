import assert from "node:assert/strict";
import fs from "node:fs";
export async function testTimeline(db) {
  const migration = fs
    .readdirSync("supabase/migrations")
    .find((p) => p.endsWith("ssl_season_calendar_and_offseason.sql"));
  await db.exec(fs.readFileSync("supabase/migrations/" + migration, "utf8"));
  await db.query(
    `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  const fixture = (
      await db.query(
        "select * from league_private.ssl_season_states order by number limit 1",
      )
    ).rows[0],
    id = fixture.id;
  await db.query("delete from league_private.ssl_season_states where id<>$1", [
    id,
  ]);
  await db.query(
    `update league_private.ssl_season_states set state=state||'{"status":"postdraft","games":[],"schedulePublished":false,"tradingOpen":true}'::jsonb where id=$1`,
    [id],
  );
  const call = async (op, p = {}) =>
    (
      await db.query("select public.ssl_manage($1,$2,$3) r", [
        op,
        id,
        JSON.stringify(p),
      ])
    ).rows[0].r;
  const get = async () =>
    (await db.query("select public.ssl_seasons() r")).rows[0].r.find(
      (s) => s.id === id,
    );
  const fail = async (f) => {
    let denied = false;
    try {
      await f();
    } catch {
      denied = true;
    }
    assert(denied, "Expected rejection");
  };
  await call("schedule", {
    away: fixture.state.teams[0].id,
    home: fixture.state.teams[1].id,
    startsAt: new Date().toISOString(),
  });
  await fail(() => call("publish_schedule"));
  await call("generate_schedule", { weekOne: "2026-09-06", time: "19:00" });
  let s = await get();
  assert.equal(s.games.length, 132);
  for (const t of s.teams) {
    const games = s.games.filter((g) => [g.away, g.home].includes(t.id));
    assert.equal(games.length, 22);
    assert.equal(games.filter((g) => g.home === t.id).length, 11);
    assert.equal(new Set(games.map((g) => g.week)).size, 22);
  }
  assert.equal(
    new Date(s.tradeDeadlineAt).toISOString(),
    "2026-11-29T05:00:00.000Z",
  );
  await call("publish_schedule");
  await call("start_season");
  const team = s.teams[2].id,
    player = s.rosters[team][1];
  await fail(() => call("extension", { team, player }));
  await db.query(
    `update league_private.ssl_season_states set state=state||jsonb_build_object('tradeDeadlineAt',now()-interval '1 second') where id=$1`,
    [id],
  );
  s = await get();
  assert.equal(s.tradingOpen, false);
  assert(s.extensionsOpen);
  await fail(() =>
    call("submit_trade", { team, teams: [team, s.teams[1].id], moves: [] }),
  );
  await call("extension", { team, player });
  assert.equal((await get()).status, "regular");
  await fail(() => call("create", { name: "S2" }));
  await db.query(
    `update league_private.ssl_season_states set state=state||jsonb_build_object('status','postseason','games',$2::jsonb) where id=$1`,
    [id, JSON.stringify(fixture.state.games)],
  );
  const ended = new Date(Date.now() - 500).toISOString();
  await call("finish", {
    champion: fixture.state.teams[0].id,
    finalist: fixture.state.teams[1].id,
    endedAt: ended,
  });
  s = await get();
  assert.equal(s.status, "retention");
  assert.equal(
    new Date(s.extensionClosesAt).getTime() - new Date(ended).getTime(),
    14 * 86400000,
  );
  await fail(() => call("create", { name: "S2" }));
  await db.query(
    `update league_private.ssl_season_states set state=state||jsonb_build_object('extensionClosesAt',now()-interval '1 second') where id=$1`,
    [id],
  );
  s = await get();
  assert.equal(s.status, "offseason");
  assert(!s.extensionsOpen);
  assert(s.tradingOpen);
  assert(s.rosters[team].includes(player));
  assert.equal(
    s.completedRosters[team].length,
    fixture.state.rosters[team].length,
  );
  const unsigned = fixture.state.rosters[team].find(
    (p) => !s.rosters[team].includes(p),
  );
  assert(!Object.values(s.rosters).flat().includes(unsigned));
  await fail(() => call("extension", { team, player: unsigned }));
  const balance = s.contractBalances.find((t) => t.team === team).tokens;
  await get();
  assert.equal(
    (await get()).contractBalances.find((t) => t.team === team).tokens,
    balance,
  );
  const other = s.teams[1].id;
  await call("submit_trade", {
    team,
    teams: [team, other],
    moves: [{ kind: "player", id: player, from: team, to: other }],
  });
  const offer = (
    await db.query("select public.ssl_inbox($1) r", [id])
  ).rows[0].r.find((o) => o.status === "pending");
  await call("accept_trade", { team: other, offer: offer.id });
  await call("approve_trade", { offer: offer.id });
  assert((await get()).rosters[other].includes(player));
  await call("create", { name: "S2" });
  const seasons = (await db.query("select public.ssl_seasons() r")).rows[0].r;
  assert.equal(seasons[0].number, 2);
  const history = seasons.find((s) => s.id === id);
  assert.equal(history.status, "archived");
  assert.equal(
    history.rosters[team].length,
    fixture.state.rosters[team].length,
  );
  await db.query("select public.ssl_manage($1,$2,$3)", [
    "teams",
    seasons[0].id,
    JSON.stringify({ slots: Array.from({ length: 12 }, (_, i) => i + 1) }),
  ]);
  const next = (await db.query("select public.ssl_seasons() r")).rows[0].r[0];
  assert(next.tradingOpen);
  assert.equal(next.tradePickSeason, 2);
  assert.equal(next.pickAssets.length, 132);
  await db.exec("set role authenticated");
  await fail(() =>
    db.query("select league_private.ssl_manage_core('create',null,'{}')"),
  );
  await db.exec("reset role");
  console.log(
    "PASS: 22-week home/away schedule, Eastern/DST cutoff, early extensions, trade deadline, two-week window, unsigned player release, contract carryover, offseason trading and S2 archive.",
  );
}
