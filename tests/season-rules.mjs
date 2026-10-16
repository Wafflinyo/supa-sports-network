import assert from "node:assert/strict";
import fs from "node:fs";
export async function testSeasonRules(db) {
  const migration = fs
    .readdirSync("supabase/migrations")
    .find((p) => p.endsWith("ssl_season_rules_and_premieres.sql"));
  // Earlier migration fixtures intentionally hold five contracts; the production database has no franchises yet.
  await db.query("update league_private.ssl_franchises set tokens=least(tokens,3)");
  await db.exec(fs.readFileSync("supabase/migrations/" + migration, "utf8"));
  await db.query(
    `select set_config('test.uid','11111111-1111-4111-8111-111111111111',false),set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  const fixture = (
      await db.query(
        "select * from league_private.ssl_season_states order by number limit 1",
      )
    ).rows[0],
    sid = fixture.id,
    teams = fixture.state.teams;
  const call = async (op, p = {}) =>
    (
      await db.query("select public.ssl_manage($1,$2,$3) r", [
        op,
        sid,
        JSON.stringify(p),
      ])
    ).rows[0].r;
  const get = async () =>
    (await db.query("select public.ssl_seasons() r")).rows[0].r.find(
      (x) => x.id === sid,
    );
  const set = async (st) =>
    db.query(
      "update league_private.ssl_season_states set state=$1 where id=$2",
      [JSON.stringify(st), sid],
    );
  const fail = async (fn, label) => {
    let err;
    try {
      await fn();
    } catch (e) {
      err = e;
    }
    assert(err, label);
  };
  const catalog = (
    await db.query("select id from league_private.ssl_catalog order by id")
  ).rows.map((p) => p.id);
  // Later season, eleven rounds plus supplemental turns for teams short after pick trades.
  await db.query(
    "update league_private.ssl_season_states set number=90 where id=$1",
    [sid],
  );
  const rosters = {},
    retains = [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0];
  let used = 0;
  teams.forEach(
    (t, i) => (rosters[t.id] = catalog.slice(used, (used += retains[i]))),
  );
  let st = {
    ...fixture.state,
    status: "drafting",
    teams,
    order: teams.map((t) => t.id),
    rosters,
    picks: [],
    games: [],
    draftCursor: 0,
    pickStartedAt: new Date().toISOString(),
    paused: false,
    pickElapsed: 0,
    offseasonTrading: false,
    tradingOpen: false,
    schedulePublished: false,
    defaults: {},
    needsDefault: [],
    playoffSeries: [],
  };
  await set(st);
  await db.query(
    "insert into league_private.ssl_pick_assets(season_number,original_team,round,owner) select 90,id,r,id from league_private.ssl_franchises cross join generate_series(1,11) r on conflict do nothing",
  );
  await db.query(
    "update league_private.ssl_pick_assets set owner=$1 where season_number=90 and original_team=$2 and round in(10,11)",
    [teams[1].id, teams[0].id],
  );
  await db.query(
    "update league_private.ssl_pick_assets set owner=$1 where season_number=90 and original_team=$2 and round=11",
    [teams[3].id, teams[2].id],
  );
  for (let i = 0; i < 132; i++) {
    st = await get();
    assert.equal(st.nextPick.round, Math.floor(i / 12) + 1);
    await call("pick", { player: catalog[used++] });
  }
  st = await get();
  assert.equal(st.nextPick.team, teams[2].id);
  assert.equal(st.nextPick.round, 12);
  assert(st.nextPick.supplemental);
  await call("pick", { player: catalog[used++] });
  st = await get();
  assert.equal(st.nextPick.team, teams[0].id);
  await call("pick", { player: catalog[used++] });
  st = await get();
  assert.equal(st.nextPick.team, teams[0].id);
  assert.equal(st.nextPick.round, 13);
  await call("pick", { player: catalog[used++] });
  st = await get();
  assert.equal(st.status, "postdraft");
  assert.equal(st.picks.length, 135);
  assert.equal(st.rosters[teams[0].id].length, 11);
  assert.equal(st.rosters[teams[2].id].length, 11);
  assert.equal(st.rosters[teams[4].id].length, 14);
  await call("undo_pick");
  assert.equal((await get()).nextPick.team, teams[0].id);
  await call("pick", { player: catalog[--used] });
  // Conferences are six and six, only commissioner can assign.
  await fail(
    () => call("conferences", { supa: teams.slice(0, 5).map((t) => t.id) }),
    "unbalanced conferences",
  );
  await call("conferences", { supa: teams.slice(0, 6).map((t) => t.id) });
  st = await get();
  assert.equal(st.teams.filter((t) => t.conference === "supa").length, 6);
  await db.query(
    `select set_config('test.access','{"role":"gm","slot":1}',false)`,
  );
  await fail(
    () => call("conferences", { supa: teams.slice(0, 6).map((t) => t.id) }),
    "GM conference edit",
  );
  await db.query(
    `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  // Atomic 14-player drop/sign, contested free agent cannot be double signed.
  st = await get();
  await set({ ...st, status: "regular" });
  const full = teams[4].id,
    drop = st.rosters[full][0],
    free = catalog.find((id) => !Object.values(st.rosters).flat().includes(id));
  await fail(
    () => call("add_player", { team: full, player: free }),
    "full roster must drop",
  );
  await call("add_player", { team: full, player: free, dropPlayer: drop });
  st = await get();
  assert.equal(st.rosters[full].length, 14);
  assert(!st.rosters[full].includes(drop));
  assert(st.rosters[full].includes(free));
  await fail(
    () => call("add_player", { team: teams[0].id, player: free }),
    "already signed free agent",
  );
  // All-star ballots: signed-in normal accounts, nine per conference, no duplicates.
  await call("open_ballot", {
    kind: "allstar",
    closesAt: new Date(Date.now() + 86400000).toISOString(),
  });
  st = await get();
  const candidates = st.ballotWindows.allstar.candidates,
    choices = ["supa", "galaxy"].flatMap((c) =>
      candidates
        .filter((p) => p.conference === c)
        .slice(0, 9)
        .map((p) => p.player),
    );
  await db.query(
    `select set_config('test.access','{"role":"participant"}',false)`,
  );
  await call("ballot", { kind: "allstar", choices });
  await fail(
    () => call("ballot", { kind: "allstar", choices: choices.slice(0, 17) }),
    "17 votes invalid",
  );
  await call("ballot", { kind: "allstar", choices });
  st = await get();
  assert.equal(st.ballotWindows.allstar.ballots, 1);
  assert.equal(st.ballotWindows.allstar.myChoices.length, 18);
  await db.query(
    `select set_config('test.uid','',false),set_config('test.access','{"role":"viewer"}',false)`,
  );
  st = await get();
  assert.equal(st.ballotWindows.allstar.myChoices.length, 0);
  await fail(
    () => call("ballot", { kind: "allstar", choices }),
    "anonymous vote",
  );
  // Report upload before premiere: freezes lineups but no public stats/score leak.
  await db.query(
    `select set_config('test.uid','11111111-1111-4111-8111-111111111111',false),set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  st = await get();
  const a = teams[0].id,
    b = teams[1].id;
  const positions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  const lineup = (t) => ({
    starters: st.rosters[t]
      .slice(0, 9)
      .map((p, i) => ({ player: p, position: positions[i] })),
    bench: st.rosters[t].slice(9),
  });
  const gid = "22222222-2222-4222-8222-222222222222";
  st = {
    ...st,
    status: "regular",
    games: [
      {
        id: gid,
        away: a,
        home: b,
        phase: "regular",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        stage: "scheduled",
        lineups: {},
      },
    ],
    defaults: { [a]: lineup(a), [b]: lineup(b) },
    needsDefault: [],
    schedulePublished: true,
  };
  await set(st);
  const report = {
    fingerprint: "f".repeat(64),
    filename: "test.xlsx",
    players: [a, b].flatMap((t, k) =>
      st.rosters[t].slice(0, 9).map((player, i) => ({
        player,
        team: t,
        positions: [positions[i]],
        stats: { runs: i === 0 ? (k ? 1 : 2) : 0, hits: 1, atBats: 3 },
      })),
    ),
  };
  await call("result", { game: gid, report });
  st = await get();
  assert.equal(st.games[0].stage, "recorded");
  assert(st.games[0].lockedAt);
  assert(st.games[0].result);
  assert(
    (
      await db.query(
        "select count(*) n from public.fantasy_player_schedule where game_key=$1 and locked_at is not null",
        ["ssl:" + gid],
      )
    ).rows[0].n > 0,
  );
  await db.query(
    `select set_config('test.access','{"role":"gm","slot":1}',false)`,
  );
  st = await get();
  assert(!st.games[0].result);
  await fail(
    () => call("game_lineup", { game: gid, useDefault: true }),
    "recorded lineup closed",
  );
  await db.query(`select set_config('test.access','{"role":"viewer"}',false)`);
  assert(!(await get()).games[0].result);
  await db.query(
    `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  await call("result", { game: gid, report });
  assert.equal((await get()).games[0].stage, "recorded");
  await call("broadcast", {
    game: gid,
    youtubeUrl: "https://youtu.be/abc",
    releaseAt: new Date(Date.now() + 172800000).toISOString(),
  });
  assert.equal((await get()).games[0].stage, "recorded");
  await fail(
    () => call("release_result", { game: gid }),
    "cannot reveal before premiere starts",
  );
  st = await get();
  st.games[0].startsAt = new Date(Date.now() - 3600000).toISOString();
  await set(st);
  await call("release_result", { game: gid });
  assert.equal((await get()).games[0].stage, "final");
  // Timer release is held during postponements and fires on the next read after clearing.
  st = await get();
  st.games[0] = {
    ...st.games[0],
    stage: "recorded",
    releaseAt: new Date(Date.now() - 1000).toISOString(),
    postponed: true,
  };
  await set(st);
  assert.equal((await get()).games[0].stage, "recorded");
  st.games[0].postponed = false;
  await set(st);
  assert.equal((await get()).games[0].stage, "final");
  // Seeded best-of series, automatic reseeding, and alternating home field.
  st = await get();
  st = {
    ...st,
    status: "postseason",
    finalStandings: teams.map((t, i) => ({ id: t.id, rank: i + 1 })),
    playoffTeams: teams.slice(0, 8).map((t) => t.id),
    playoffSeries: [],
    games: [],
  };
  await set(st);
  await call("advance_playoffs");
  st = await get();
  assert.deepEqual(
    st.playoffSeries.map((x) => [x.highSeed, x.lowSeed]),
    [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ],
  );
  const series = st.playoffSeries[0];
  await fail(
    () =>
      call("schedule", {
        seriesId: series.id,
        home: series.low,
        away: series.high,
        startsAt: new Date().toISOString(),
      }),
    "wrong first home team",
  );
  await call("schedule", {
    seriesId: series.id,
    home: series.high,
    away: series.low,
    startsAt: new Date().toISOString(),
  });
  st = await get();
  assert.equal(st.games[0].seriesGame, 1);
  // Test reseeding with upsets: seeds 8,4,2,6 survive -> 2/8 and 4/6.
  st.games = st.playoffSeries.flatMap((x, i) =>
    [1, 2].map((n) => ({
      id: x.id + n,
      phase: "playoffs",
      seriesId: x.id,
      stage: "final",
      away: x.high,
      home: x.low,
      result: {
        scores: {
          [x.high]: i === 0 || i === 3 ? 0 : 1,
          [x.low]: i === 0 || i === 3 ? 1 : 0,
        },
      },
    })),
  );
  await set(st);
  await call("advance_playoffs");
  st = await get();
  assert.deepEqual(
    st.playoffSeries
      .filter((x) => x.round === "semifinal")
      .map((x) => [x.highSeed, x.lowSeed]),
    [
      [2, 8],
      [4, 6],
    ],
  );
  const semis = st.playoffSeries.filter((x) => x.round === "semifinal");
  st.games.push(
    ...semis.flatMap((x, i) =>
      [1, 2].map((n) => ({
        id: x.id + n,
        phase: "playoffs",
        seriesId: x.id,
        stage: "final",
        away: x.high,
        home: x.low,
        result: {
          scores: { [x.high]: i === 0 ? 0 : 1, [x.low]: i === 0 ? 1 : 0 },
        },
      })),
    ),
  );
  await set(st);
  await call("advance_playoffs");
  st = await get();
  const final = st.playoffSeries.find((x) => x.round === "final");
  assert.equal(final.bestOf, 5);
  assert.equal(final.highSeed, 4);
  assert.equal(final.lowSeed, 8);
  const finalGame = (n) => ({
    id: final.id + n,
    seriesId: final.id,
    phase: "playoffs",
    stage: "final",
    result: { scores: { [final.high]: 1, [final.low]: 0 } },
  });
  st.games.push(finalGame(1), finalGame(2));
  await set(st);
  assert(!(await get()).playoffSeries.find((x) => x.id === final.id).winner);
  st.games.push(finalGame(3));
  await set(st);
  assert.equal(
    (await get()).playoffSeries.find((x) => x.id === final.id).winner,
    final.high,
  );
  // Contract balances reset to three, cannot exceed three, and expire without carrying.
  await db.query(`update league_private.ssl_franchises set tokens=1`);
  await db.query(
    "delete from league_private.ssl_token_grants where season=$1",
    [sid],
  );
  st = await get();
  await set({
    ...st,
    status: "regular",
    extensionsOpen: false,
    tradeDeadlineAt: new Date(Date.now() - 1000).toISOString(),
  });
  assert((await get()).contractBalances.every((t) => t.tokens === 3));
  await fail(
    () => db.query("update league_private.ssl_franchises set tokens=4"),
    "max three contracts",
  );
  await fail(
    () =>
      call("submit_trade", {
        team: a,
        teams: [a, b],
        moves: [{ kind: "contract", from: a, to: b, quantity: 1 }],
      }),
    "contracts not tradable",
  );
  st = await get();
  await set({
    ...st,
    status: "retention",
    extensionClosesAt: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal((await get()).status, "offseason");
  assert((await get()).contractBalances.every((t) => t.tokens === 0));
  console.log(
    "PASS: eleven-round draft + supplemental snake/undo, conferences, cap-14 atomic signing, account ballots, private reports/locks/release, playoff reseeding/home field.",
  );
}
