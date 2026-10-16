import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import fs from "node:fs";
import {
  readRio,
  buildReport,
  aggregate,
  validLineup,
  standings,
  fantasyGames,
} from "../src/season-data.js";
const path = process.env.SSL_RIO_FIXTURE;
if (!path) {
  console.log(
    "Rio fixture test: set SSL_RIO_FIXTURE to an existing Project Rio XLSX.",
  );
  process.exit(0);
}
const players = JSON.parse(fs.readFileSync("src/players.json"));
const bytes = fs.readFileSync(path),
  wb = new ExcelJS.Workbook();
await wb.xlsx.load(bytes);
const rows = wb
  .getWorksheet("Stats")
  .getSheetValues()
  .slice(2)
  .filter((r) => r?.[2] && r?.[3] && !r[2].includes("Totals"));
const labels = [...new Set(rows.map((r) => r[1]))],
  a = "a",
  b = "b",
  ids = new Map(players.map((p) => [p.name, p.id]));
let next = 1000;
const roster = { a: [], b: [] };
for (const r of rows) {
  if (!ids.has(r[2])) {
    ids.set(r[2], ++next);
    players.push({ id: next, name: r[2] });
  }
  roster[r[1] === labels[0] ? "a" : "b"].push(ids.get(r[2]));
}
const game = {
    id: "test",
    away: a,
    home: b,
    stage: "final",
    phase: "regular",
    startsAt: "2026-10-16T12:00:00Z",
  },
  season = {
    id: "test",
    teams: [
      { id: a, slot: 1 },
      { id: b, slot: 2 },
    ],
    rosters: roster,
    schedulePublished: true,
    games: [game],
  };
const file = {
  name: "sample.xlsx",
  size: bytes.length,
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
};
const preview = await readRio(file, season, game, players);
assert.equal(preview.rows.length, 18);
assert(preview.rows.every((r) => r.chosen));
const report = buildReport(preview, labels[0], season, game, players);
const totals = Object.fromEntries(
  [a, b].map((t) => [
    t,
    report.players
      .filter((p) => p.team === t)
      .reduce((n, p) => n + p.stats.runs, 0),
  ]),
);
assert.deepEqual(totals, { a: 9, b: 11 });
const birdo = report.players.find((p) => p.player === ids.get("Birdo"));
assert.equal(birdo.stats.outs, 10);
assert.equal(birdo.stats.pitchStrikeouts, 3);
const wiggler = report.players.find((p) => p.player === ids.get("Wiggler"));
assert.equal(wiggler.stats.outs, 4);
assert.equal(wiggler.stats.hitsAllowed, 11);
game.result = { players: report.players, scores: totals };
const sums = aggregate(season);
assert.equal(sums[ids.get("Birdo")].gamesPlayed, 1);
assert(Number.isFinite(sums[ids.get("Birdo")].era7));
assert.equal(standings(season)[0].id, b);
assert.equal(fantasyGames([season]).length, 1);
assert.equal(validLineup(season, a, { starters: [], bench: [] }), false);
console.log(
  "PASS: actual Rio XLSX, 18 participants, 9–11 score, Birdo 10 outs / 3 K, Wiggler 4 outs / 11 HA, team standings and fantasy projection.",
);

// Duplicate Rio names must not duplicate the same pitcher's statistics.
const duplicate = structuredClone({ ...preview, file: undefined });
const pitched = duplicate.rows.find((r) => r.chosen === ids.get("Birdo")),
  other = duplicate.rows.find(
    (r) => r.label === pitched.label && r.chosen !== pitched.chosen,
  );
pitched.player = "Green Mii (M)";
other.player = "Green Mii (M)";
const resultWithMii = buildReport(duplicate, labels[0], season, game, players);
assert.equal(
  resultWithMii.players.find((p) => p.player === other.chosen).stats.outs,
  report.players.find((p) => p.player === other.chosen).stats.outs,
);
assert.equal(
  resultWithMii.players.find((p) => p.player === pitched.chosen).stats.outs,
  10,
);
duplicate.pitch.find((p) => p.chosen === pitched.chosen).chosen = "";
assert.throws(
  () => buildReport(duplicate, labels[0], season, game, players),
  /Map pitching row/,
);
console.log(
  "PASS: duplicate Mii report names cannot duplicate pitching stats; unmapped pitchers block posting.",
);
