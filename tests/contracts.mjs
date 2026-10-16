import assert from "node:assert/strict";
import fs from "node:fs";
export async function testContracts(db) {
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/" +
        fs
          .readdirSync("supabase/migrations")
          .find((p) => p.endsWith("ssl_contract_caps_and_odds.sql")),
      "utf8",
    ),
  );
  await db.query(
    `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  let season = (
      await db.query(
        "select * from league_private.ssl_season_states order by number limit 1",
      )
    ).rows[0],
    sid = season.id,
    teams = season.state.teams;
  await db.query(
    `update league_private.ssl_season_states set state=(state-'extensionClosesAt'-'champion'-'finalist'-'archivedBalances'-'archivedPickAssets')||jsonb_build_object('status','regular','extensionsOpen',false,'tradeDeadlineAt',now()-interval '1 second') where id=$1`,
    [sid],
  );
  const get = async () =>
      (await db.query("select public.ssl_seasons() r")).rows[0].r.find(
        (s) => s.id === sid,
      ),
    call = async (op, p = {}) =>
      (
        await db.query("select public.ssl_manage($1,$2,$3) r", [
          op,
          sid,
          JSON.stringify(p),
        ])
      ).rows[0].r;
  const fail = async (f) => {
    let failed = false;
    try {
      await f();
    } catch {
      failed = true;
    }
    assert(failed, "Expected rejection");
  };
  for (const [carry, total] of [
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 5],
    [5, 5],
  ]) {
    await db.query(
      "delete from league_private.ssl_token_grants where season=$1",
      [sid],
    );
    await db.query(
      "update league_private.ssl_franchises set tokens=$1 where id=$2",
      [carry, teams[0].id],
    );
    await db.query(
      `update league_private.ssl_season_states set state=jsonb_set(state,'{extensionsOpen}','false') where id=$1`,
      [sid],
    );
    assert.equal(
      (await get()).contractBalances.find((t) => t.team === teams[0].id).tokens,
      total,
    );
  }
  await call("postseason");
  let st = await get();
  assert.equal(st.playoffTeams.length, 8);
  assert.equal(st.finalStandings.length, 12);
  const rankings = Object.fromEntries(
    st.finalStandings.map((r) => [r.rank, r.id]),
  );
  const quote = async (st, team, count) =>
    (
      await db.query("select league_private.ssl_extension_quote($1,$2,$3) r", [
        JSON.stringify(st),
        team,
        count,
      ])
    ).rows[0].r;
  for (const [rank, mod] of [
    [1, 5],
    [8, 5],
    [9, -10],
    [10, -10],
    [11, -15],
    [12, -20],
  ]) {
    const q = await quote(st, rankings[rank], 2);
    assert.equal(q.base, 70);
    assert.equal(q.ordinal, 3);
    assert.equal(q.modifier, mod);
    assert.equal(q.total, 70 + mod);
  }
  for (const [n, base] of [
    [0, 100],
    [1, 85],
    [2, 70],
    [3, 50],
    [4, 25],
    [8, 15],
  ])
    assert.equal((await quote(st, rankings[1], n)).base, base);
  await fail(() =>
    call("schedule", {
      away: rankings[9],
      home: rankings[1],
      startsAt: new Date().toISOString(),
      playoffRound: "quarterfinal",
    }),
  );
  await call("schedule", {
    away: rankings[1],
    home: rankings[2],
    startsAt: new Date().toISOString(),
    playoffRound: "semifinal",
  });
  st = await get();
  assert.equal((await quote(st, rankings[1], 2)).modifier, 10);
  await call("schedule", {
    away: rankings[1],
    home: rankings[2],
    startsAt: new Date().toISOString(),
    playoffRound: "final",
  });
  st = await get();
  assert.equal((await quote(st, rankings[1], 2)).modifier, 15);
  assert.equal(
    (await quote({ ...st, champion: rankings[1] }, rankings[1], 2)).modifier,
    20,
  );
  await db.query(
    "delete from league_private.ssl_extension_offers where season=$1",
    [sid],
  );
  await db.query(
    "delete from league_private.ssl_extensions where season_number=2",
  );
  const team = rankings[1],
    player = st.rosters[team][3];
  await db.query(
    "delete from league_private.ssl_extension_history where franchise=$1 and player=$2",
    [team, player],
  );
  await db.query(
    "update league_private.ssl_franchises set tokens=2 where id=$1",
    [team],
  );
  const preview = async (t, p) =>
    (
      await db.query("select public.ssl_extension_preview($1,$2,$3) r", [
        sid,
        t,
        p,
      ])
    ).rows[0].r;
  let q = await preview(team, player);
  assert.equal(q.total, 100);
  assert.equal(
    (await get()).contractBalances.find((t) => t.team === team).tokens,
    2,
  );
  await fail(() =>
    call("extension", { team, player, quoteFingerprint: "stale" }),
  );
  assert.equal(
    (await get()).contractBalances.find((t) => t.team === team).tokens,
    2,
  );
  const signed = await call("extension", {
    team,
    player,
    quoteFingerprint: q.fingerprint,
  });
  assert.equal(signed.accepted, true);
  assert.equal(signed.remaining, 1);
  await fail(() =>
    call("extension", { team, player, quoteFingerprint: q.fingerprint }),
  );
  assert.equal(
    (await get()).contractBalances.find((t) => t.team === team).tokens,
    1,
  );
  const badTeam = rankings[12],
    badPlayer = st.rosters[badTeam][3];
  await db.query(
    "insert into league_private.ssl_extension_history values($1,$2,8) on conflict(franchise,player) do update set accepted=8",
    [badTeam, badPlayer],
  );
  await db.query(
    "update league_private.ssl_franchises set tokens=2 where id=$1",
    [badTeam],
  );
  q = await preview(badTeam, badPlayer);
  assert.equal(q.total, 0);
  const rejected = await call("extension", {
    team: badTeam,
    player: badPlayer,
    quoteFingerprint: q.fingerprint,
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.remaining, 1);
  assert.equal(
    (
      await db.query(
        "select accepted from league_private.ssl_extension_history where franchise=$1 and player=$2",
        [badTeam, badPlayer],
      )
    ).rows[0].accepted,
    8,
  );
  await db.query(`select set_config('test.access',$1,false)`, [
    JSON.stringify({ role: "gm", slot: teams.find((t) => t.id === team).slot }),
  ]);
  await fail(() => preview(badTeam, badPlayer));
  await db.query(
    `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  );
  await db.query(
    `update league_private.ssl_season_states set state=state||'{"status":"offseason","tradingOpen":true}'::jsonb where id=$1`,
    [sid],
  );
  await db.query(
    "update league_private.ssl_franchises set tokens=5 where id=$1",
    [team],
  );
  await db.query(
    "update league_private.ssl_franchises set tokens=1 where id=$1",
    [badTeam],
  );
  await call("submit_trade", {
    team: badTeam,
    teams: [team, badTeam],
    note: "cap regression",
    moves: [{ kind: "contract", quantity: 1, from: badTeam, to: team }],
  });
  const over = (
    await db.query("select public.ssl_inbox($1) r", [sid])
  ).rows[0].r.find((o) => o.body.note === "cap regression");
  await call("accept_trade", { team, offer: over.id });
  await fail(() => call("approve_trade", { offer: over.id }));
  assert.equal(
    (
      await db.query(
        "select tokens from league_private.ssl_franchises where id=$1",
        [team],
      )
    ).rows[0].tokens,
    5,
  );
  assert.equal(
    (
      await db.query(
        "select tokens from league_private.ssl_franchises where id=$1",
        [badTeam],
      )
    ).rows[0].tokens,
    1,
  );
  await db.exec("set role anon");
  await fail(() =>
    db.query("select public.ssl_extension_preview($1,$2,$3)", [
      sid,
      team,
      player,
    ]),
  );
  await db.exec("reset role");
  console.log(
    "PASS: five-contract carryover cap, all finish modifiers, top-eight qualification, highest playoff bonus, no-cost preview, stale-quote protection, accept/reject consumption, repeat history and role restrictions.",
  );
}
