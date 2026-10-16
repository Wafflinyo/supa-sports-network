process.setUncaughtExceptionCaptureCallback((e) => {
  console.error(e.message, e.internalQuery || "", e.where || "");
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e.message, e.internalQuery || "", e.where || "");
  process.exit(1);
});
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema league_private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function league_private.current_access() returns jsonb language sql as $$select coalesce(nullif(current_setting('test.access',true),''),'{}')::jsonb$$;
create table public.ssl_teams(slot int primary key,name text,logo_path text);
create table public.fantasy_player_schedule(game_key text,player_id int check(player_id between 1 and 173),starts_at timestamptz,primary key(game_key,player_id));
create table public.fantasy_draft_picks(league_id uuid,pick_number int,user_id uuid,player_id int check(player_id between 1 and 173));
create table public.fantasy_week_lineups(player_id int check(player_id between 1 and 173));
create table public.fantasy_leagues(id uuid,state text);create table public.fantasy_draft_order(league_id uuid,user_id uuid,slot int);
grant usage on schema league_private to anon,authenticated;`);
const sql = fs.readFileSync(
  "supabase/migrations/20261016025833_ssl_season_workflows.sql",
  "utf8",
);
try {
  await db.exec(sql);
} catch (e) {
  console.error("SCHEMA ERROR", e.message, e.position);
  throw e;
}
for (const migration of fs
  .readdirSync("supabase/migrations")
  .filter((p) => p.endsWith("ssl_fantasy_roster_eligibility.sql")))
  await db.exec(fs.readFileSync("supabase/migrations/" + migration, "utf8"));
console.log("Schema loaded");
const actor = "11111111-1111-4111-8111-111111111111";
await db.query(
  `select set_config('test.uid',$1,false),set_config('test.access','{"role":"commissioner","slot":0}',false)`,
  [actor],
);
const manage = async (op, season, payload = {}) =>
  (
    await db.query("select public.ssl_manage($1,$2,$3::jsonb) result", [
      op,
      season,
      JSON.stringify(payload),
    ])
  ).rows[0].result;
const get = async () =>
  (await db.query("select public.ssl_seasons() result")).rows[0].result[0];
const expectFail = async (fn, text) => {
  try {
    await fn();
  } catch (e) {
    console.log("Rejected:", text);
    return;
  }
  throw Error("Expected rejection: " + text);
};
let sid = (await manage("create", null, { name: "S1" })).id;
await db.exec(
  "insert into public.ssl_teams select i,'Test Team '||i,i||'/logo.png' from generate_series(1,12) i",
);
await manage("teams", sid, {
  slots: Array.from({ length: 12 }, (_, i) => i + 1),
});
await manage("poll", sid, {
  closesAt: new Date(Date.now() + 3600000).toISOString(),
  options: [1, 2].map((i) => ({
    id: String(i),
    date: new Date(Date.now() + i * 86400000).toISOString(),
  })),
});
await manage("schedule_draft", sid, {
  draftAt: new Date(Date.now() + 86400000).toISOString(),
  lotteryAt: new Date(Date.now() + 86400000 - 1200000).toISOString(),
});
await expectFail(() => manage("pick", sid, { player: 1 }), "early draft pick");
await db.query(
  `update league_private.ssl_season_states set state=state||jsonb_build_object('draftAt',now()-interval '1 second','lotteryAt',now()-interval '20 minutes') where id=$1`,
  [sid],
);
let st = await get();
if (st.order.length !== 12 || st.status !== "drafting")
  throw Error("Auto lottery/draft failed");
const before = JSON.stringify(st.order);
if (JSON.stringify((await get()).order) !== before)
  throw Error("Lottery rerolled");
await manage("pause", sid);
await expectFail(() => manage("pick", sid, { player: 1 }), "paused draft");
await manage("pause", sid);
for (let i = 0; i < 132; i++)
  await manage("pick", sid, {
    player: (
      await db.query(
        "select id from league_private.ssl_catalog order by id limit 1 offset $1",
        [i],
      )
    ).rows[0].id,
  });
st = await get();
if (st.status !== "postdraft" || st.picks.length !== 132)
  throw Error("Draft did not finish");
for (const t of st.teams) {
  const r = st.rosters[t.id];
  if (r.length !== 11) throw Error("Roster count");
  await manage("default_lineup", sid, {
    team: t.id,
    lineup: {
      starters: r.slice(0, 9).map((p, i) => ({
        player: p,
        position: ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"][i],
      })),
      bench: r.slice(9),
    },
  });
}
st = await get();
if (!st.tradingOpen) throw Error("Trading did not open");
const a = st.teams[0],
  b = st.teams[1],
  c = st.teams[2];
await db.query(`select set_config('test.access',$1,false)`, [
  JSON.stringify({ role: "gm", slot: a.slot }),
]);
await expectFail(
  () =>
    manage("default_lineup", sid, { team: b.id, lineup: st.defaults[b.id] }),
  "GM editing another team",
);
await manage("submit_trade", sid, {
  teams: [a.id, b.id],
  moves: [{ kind: "player", id: st.rosters[a.id][0], from: a.id, to: b.id }],
});
let offers = (await db.query("select public.ssl_inbox($1) result", [sid]))
  .rows[0].result;
const trade = offers[0].id;
await db.query(`select set_config('test.access',$1,false)`, [
  JSON.stringify({ role: "gm", slot: b.slot }),
]);
await manage("accept_trade", sid, { offer: trade });
await db.query(
  `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
);
await manage("approve_trade", sid, { offer: trade });
st = await get();
if (st.rosters[a.id].length !== 10)
  throw Error("Underfilled trade not allowed");
await manage("random_fill", sid, { team: a.id });
st = await get();
if (st.rosters[a.id].length !== 11) throw Error("Random fill incorrect");
for (const t of [a, b]) {
  const r = st.rosters[t.id];
  await manage("default_lineup", sid, {
    team: t.id,
    lineup: {
      starters: r.slice(0, 9).map((p, i) => ({
        player: p,
        position: ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"][i],
      })),
      bench: r.slice(9),
    },
  });
}
st = await get();
const outgoing = st.pickAssets.filter((p) => p.owner === a.id).slice(0, 3);
await manage("submit_trade", sid, {
  team: a.id,
  teams: [a.id, b.id],
  note: "pick minimum test",
  moves: outgoing.map((p) => ({
    kind: "pick",
    id: p.id,
    from: a.id,
    to: b.id,
  })),
});
const badTrade = (
  await db.query("select public.ssl_inbox($1) result", [sid])
).rows[0].result.find((o) => o.body.note === "pick minimum test");
await manage("accept_trade", sid, { team: b.id, offer: badTrade.id });
await expectFail(
  () => manage("approve_trade", sid, { offer: badTrade.id }),
  "trade below nine future picks",
);
if ((await get()).pickAssets.filter((p) => p.owner === a.id).length !== 11)
  throw Error("Failed trade did not roll back");
await manage("cancel_trade", sid, { offer: badTrade.id });
await manage("schedule", sid, {
  away: a.id,
  home: b.id,
  startsAt: new Date(Date.now() - 10000).toISOString(),
});
await manage("publish_schedule", sid);
await manage("start_season", sid);
st = await get();
let game = st.games[0];
await manage("start_game", sid, { game: game.id });
await expectFail(
  () => manage("drop_player", sid, { team: b.id, player: st.rosters[b.id][0] }),
  "roster move during live game",
);
const report = {
  fingerprint: "a".repeat(64),
  filename: "test.xlsx",
  players: [a, b].flatMap((t, teamIndex) =>
    st.defaults[t.id].starters.map((p, i) => ({
      player: p.player,
      team: t.id,
      positions: [p.position],
      stats: {
        atBats: 3,
        hits: i === 0 && teamIndex === 0 ? 1 : 0,
        singles: i === 0 && teamIndex === 0 ? 1 : 0,
        runs: i === 0 && teamIndex === 0 ? 1 : 0,
        outs: i === 0 ? 21 : 0,
        pitchStrikeouts: i === 0 ? 2 : 0,
      },
    })),
  ),
};
await manage("result", sid, { game: game.id, report });
st = await get();
if (st.games[0].stage !== "final") throw Error("Result not posted");
await manage("result", sid, { game: game.id, report });
if ((await get()).games.length !== 1) throw Error("Correction duplicated game");
await manage("postseason", sid);
await manage("schedule", sid, {
  away: a.id,
  home: b.id,
  startsAt: new Date(Date.now() - 10000).toISOString(),
});
st = await get();
game = st.games[1];
await manage("start_game", sid, { game: game.id });
await manage("result", sid, {
  game: game.id,
  report: { ...report, fingerprint: "b".repeat(64) },
});
await manage("finish", sid, { champion: a.id, finalist: b.id });
st = await get();
if (!st.contractBalances.every((x) => x.tokens === 3))
  throw Error("Contracts not minted");
const player = st.rosters[a.id][0];
await manage("extension", sid, { team: a.id, player });
await expectFail(
  () => manage("extension", sid, { team: a.id, player }),
  "repeat extension offer",
);
st = await get();
if (
  st.extensionOffers[0].accepted !== true ||
  st.extensionHistory[0].accepted !== 1
)
  throw Error("Guaranteed first extension failed");
if (process.env.SSL_TEST_FIXTURE)
  fs.writeFileSync(process.env.SSL_TEST_FIXTURE, JSON.stringify(st));
const repeatPlayer = st.rosters[c.id][0];
await db.query(
  "insert into league_private.ssl_extension_history values($1,$2,5)",
  [c.id, repeatPlayer],
);
await db.exec("select setseed(0.1)");
await manage("extension", sid, { team: c.id, player: repeatPlayer });
let after = await get(),
  off = after.extensionOffers.find(
    (o) => o.player === repeatPlayer && o.franchise === c.id,
  );
if (after.contractBalances.find((x) => x.team === c.id).tokens !== 2)
  throw Error("Extension did not consume contract");
if (
  after.extensionHistory.find(
    (x) => x.player === repeatPlayer && x.franchise === c.id,
  ).accepted !==
  5 + (off.accepted ? 1 : 0)
)
  throw Error("Repeat history advanced on rejection");
if (off.accepted) throw Error("Seeded rejection fixture unexpectedly accepted");
await expectFail(
  () => manage("extension", sid, { team: c.id, player: repeatPlayer }),
  "rejected offer cannot be rerolled",
);
await db.query(`select set_config('test.access',$1,false)`, [
  JSON.stringify({ role: "gm", slot: c.slot }),
]);
if (
  (await db.query("select public.ssl_inbox($1) result", [sid])).rows[0].result
    .length
)
  throw Error("Unrelated team saw trade inbox");
await db.query(
  `select set_config('test.access','{"role":"commissioner","slot":0}',false)`,
);
console.log(
  "Verified rejection consumes contract and keeps repeat history unchanged.",
);
await manage("archive", sid);
const second = (await manage("create", null, { name: "S2" })).id;
await manage("teams", second, {
  slots: Array.from({ length: 12 }, (_, i) => i + 1),
});
if (!(await get()).rosters[a.id].includes(player))
  throw Error("Retained player not carried forward");
await db.query(
  `select set_config('test.access','{"role":"participant"}',false)`,
);
await expectFail(
  () => manage("create", null, { name: "illegal" }),
  "ordinary user writing season",
);
await expectFail(
  () => db.query("select league_private.make_fantasy_pick($1,193)", [sid]),
  "fantasy drafting an unrostered character",
);
console.log(
  "PASS: season lifecycle, 132 picks, snake, paused and early picks, GM isolation, trade/refill, results/correction, playoff extensions and carryover.",
);
await db.exec("set role anon");
await db.query("select public.ssl_seasons()");
await expectFail(
  () => db.query("select * from league_private.ssl_season_states"),
  "anonymous direct private table read",
);
await expectFail(
  () => db.query("select public.ssl_manage('create',null,'{}')"),
  "anonymous write RPC",
);
await db.exec("reset role");
if (process.env.SSL_TIMELINE_TEST)
  await (await import("./season-timeline.mjs")).testTimeline(db);
if (process.env.SSL_TIMELINE_TEST)
  await (await import("./contracts.mjs")).testContracts(db);
if (process.env.SSL_RULES_TEST) await (await import('./season-rules.mjs')).testSeasonRules(db);
if (process.env.SSL_RULES_TEST) await (await import('./fantasy-window.mjs')).testFantasyWindow(db);
await db.close();
