import columns from "./temporary-stat-columns.json" with { type: "json" };
export const positions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
export const rosterOf = (s, t) => s?.rosters?.[t] || [];
export const validLineup = (s, t, l) => {
  const roster = rosterOf(s, t),
    starters = l?.starters || [],
    bench = l?.bench || [],
    all = [...starters.map((x) => Number(x.player)), ...bench.map(Number)];
  return (
    roster.length >= 11 &&
    starters.length === 9 &&
    new Set(starters.map((x) => x.position)).size === 9 &&
    starters.every((x) => positions.includes(x.position)) &&
    all.length === roster.length &&
    new Set(all).size === roster.length &&
    all.every((x) => roster.includes(x))
  );
};
export const elapsed = (s, now = Date.now()) =>
  Math.floor(
    Number(s?.pickElapsed || 0) +
      (s?.paused
        ? 0
        : Math.max(0, (now - new Date(s?.pickStartedAt || now)) / 1000)),
  );
export const clock = (n) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export function fantasyGames(seasons) {
  return seasons.flatMap((s) =>
    s.schedulePublished
      ? s.games.map((g) => ({
          id: "ssl:" + g.id,
          startsAt: g.startsAt,
          playerScores: Object.fromEntries(
            (g.result?.players || []).map((p) => [
              p.player,
              { total: p.fantasyPoints },
            ]),
          ),
        }))
      : [],
  );
}
export function aggregate(season) {
  const stats = {};
  for (const game of season?.games || []) {
    if (game.stage !== "final") continue;
    for (const p of game.result.players) {
      const st = stats[p.player] || { gamesPlayed: 0, positionsPlayed: [] };
      st.gamesPlayed++;
      for (const [k, v] of Object.entries(p.stats)) st[k] = (st[k] || 0) + v;
      st.positionsPlayed = [
        ...new Set([...st.positionsPlayed, ...(p.positions || [])]),
      ];
      stats[p.player] = st;
    }
  }
  for (const st of Object.values(stats)) {
    const ratio = (n, d) => (d ? (n || 0) / d : 0);
    st.battingAverage = ratio(st.hits, st.atBats);
    st.onBase = ratio(
      (st.hits || 0) + (st.batWalks || 0) + (st.hitByPitch || 0),
      st.plateAppearances,
    );
    st.slug = ratio(st.totalBases, st.atBats);
    st.onBasePlusSlug = st.onBase + st.slug;
    st.starSlug = ratio(st.starBases, st.starSwings);
    st.inningsPitched = Number(((st.outs || 0) / 3).toFixed(2));
    st.era7 = ratio((st.earnedRuns || 0) * 21, st.outs);
    st.era9 = ratio((st.earnedRuns || 0) * 27, st.outs);
    st.whip = ratio(
      ((st.hitsAllowed || 0) + (st.pitchWalks || 0)) * 3,
      st.outs,
    );
    st.baAgainst = ratio(
      st.hitsAllowed,
      (st.battersFaced || 0) - (st.pitchWalks || 0) - (st.beanBalls || 0),
    );
    st.obAgainst = ratio(
      (st.hitsAllowed || 0) + (st.pitchWalks || 0) + (st.beanBalls || 0),
      st.battersFaced,
    );
    st.slgAgainst = ratio(
      (st.singlesAllowed || 0) +
        2 * (st.doublesAllowed || 0) +
        3 * (st.triplesAllowed || 0) +
        4 * (st.hrAllowed || 0),
      (st.battersFaced || 0) - (st.pitchWalks || 0) - (st.beanBalls || 0),
    );
    st.opsAgainst = st.obAgainst + st.slgAgainst;
  }
  return stats;
}
export function standings(season) {
  return (season?.teams || [])
    .map((t) => {
      let wins = 0,
        losses = 0,
        runsFor = 0,
        runsAgainst = 0;
      for (const g of season.games) {
        if (
          g.stage !== "final" ||
          g.phase !== "regular" ||
          ![g.away, g.home].includes(t.id)
        )
          continue;
        const a = g.result.scores[t.id],
          b = g.result.scores[g.away === t.id ? g.home : g.away];
        runsFor += a;
        runsAgainst += b;
        a > b ? wins++ : losses++;
      }
      return {
        ...t,
        wins,
        losses,
        runsFor,
        runsAgainst,
        pct: wins + losses ? wins / (wins + losses) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.pct - a.pct ||
        b.runsFor - b.runsAgainst - (a.runsFor - a.runsAgainst) ||
        a.slot - b.slot,
    );
}
const normalize = (x) =>
  String(x ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const counts = new Set(
  Object.values(columns)
    .flat()
    .map(([k]) => k)
    .filter(
      (k) =>
        ![
          "gamesPlayed",
          "inningsPitched",
          "battingAverage",
          "onBase",
          "slug",
          "onBasePlusSlug",
          "starSlug",
          "era7",
          "era9",
          "whip",
          "baAgainst",
          "obAgainst",
          "slgAgainst",
          "opsAgainst",
          "positionsPlayed",
        ].includes(k),
    ),
);
const aliases = {
  atBats: ["At Bats", "At-Bats"],
  plateAppearances: ["Plate Appearances"],
  batStrikeouts: ["Strikeouts"],
  batWalks: ["Walks"],
  oneHr: ["1HR", "1 Run Home Runs", "1-run HR"],
  twoHr: ["2HR", "2 Run Home Runs"],
  threeHr: ["3HR", "3 Run Home Runs"],
  itpHomeRuns: ["ITP Home Runs"],
  sacFlys: ["Sac Flys", "Sacrifice Flies"],
  batStarsUsed: ["Stars Used"],
  pitchStrikeouts: ["Strikeouts"],
  pitchWalks: ["Walks"],
  pitchStarsUsed: ["Stars Used"],
  hrAllowed: ["HR Allowed"],
  rbi: ["RBI", "RBIs"],
};
export async function readRio(file, season, game, players) {
  if (
    file.size > 10 * 1024 * 1024 ||
    !file.name.toLowerCase().endsWith(".xlsx")
  )
    throw Error("Choose a Project Rio XLSX under 10 MB.");
  const bytes = await file.arrayBuffer(),
    ExcelJS = (await import("exceljs")).default,
    wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  const text = (v) =>
    v && typeof v === "object"
      ? (v.result ?? v.text ?? v.richText?.map((x) => x.text).join("") ?? "")
      : v;
  function rows(sheetName) {
    const sheet = wb.getWorksheet(sheetName);
    if (!sheet) throw Error(`Missing ${sheetName} sheet.`);
    if (sheet.rowCount > 1000 || sheet.columnCount > 150)
      throw Error("Unexpected report dimensions.");
    const heading = sheet
      .getRow(1)
      .values.slice(1)
      .map((v) => normalize(text(v)));
    const out = [];
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      const d = Object.fromEntries(
        heading.map((h, j) => [h, text(row.getCell(j + 1).value)]),
      );
      d.row = i;
      out.push(d);
    });
    return out;
  }
  const bat = rows("Stats").filter(
      (r) =>
        r.player &&
        r.position &&
        String(r.position).toUpperCase() !== "N/A" &&
        !String(r.player).includes("Totals"),
    ),
    pitch = rows("Pitching").filter(
      (r) => r.player && !String(r.player).includes("Totals"),
    );
  if (bat.length < 18 || bat.length > 50)
    throw Error("Expected 18–50 participating player rows.");
  const labels = [...new Set(bat.map((r) => String(r.team || "")))];
  if (labels.length !== 2 || labels.includes(""))
    throw Error("Report must identify two teams.");
  const eligible = players.filter((p) =>
    [...rosterOf(season, game.away), ...rosterOf(season, game.home)].includes(
      p.id,
    ),
  );
  const targetRows = bat.map((r) => {
    let candidates = eligible.filter((p) =>
      [p.name, ...(p.rioAliases || [])].some(
        (n) => normalize(n) === normalize(r.player),
      ),
    );
    if (!candidates.length && String(r.player).includes("Mii"))
      candidates = eligible.filter(
        (p) =>
          p.kind === "mii" &&
          normalize(r.player).startsWith(normalize(p.color)),
      );
    return {
      ...r,
      chosen: candidates.length === 1 ? candidates[0].id : "",
      label: String(r.team),
    };
  });
  return {
    file,
    filename: file.name,
    fingerprint: Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join(""),
    labels,
    rows: targetRows,
    pitch,
  };
}
export function buildReport(preview, awayLabel, season, game, players, mvp) {
  const pickTeam = (r) => (r.label === awayLabel ? game.away : game.home),
    result = [];
  function numeric(r, key, category) {
    const label = Object.values(columns)
      .flat()
      .find(([k]) => k === key)?.[1];
    const names = aliases[key] || [label || key];
    const match = names.map(normalize).find((n) => r[n] != null && r[n] !== "");
    if (!match) return 0;
    const n = Number(r[match]);
    if (!Number.isInteger(n) || n < 0)
      throw Error(`${r.player}: invalid ${label || key}`);
    return n;
  }
  for (const r of preview.rows) {
    const player = Number(r.chosen),
      team = pickTeam(r);
    if (!player || !rosterOf(season, team).includes(player))
      throw Error(`Map ${r.player} to a player from the correct team.`);
    const stats = Object.fromEntries([...counts].map((k) => [k, 0]));
    for (const [key] of [
      ...columns["Offensive Stats"],
      ...columns["Defensive Stats"],
    ])
      if (counts.has(key) && key !== "mvps")
        stats[key] = numeric(r, key, "batting");
    stats.mvps = player === Number(mvp) ? 1 : 0;
    stats.starBases = Number(r.starbaseshelper || 0);
    stats.totalBases =
      stats.singles +
      2 * stats.doubles +
      3 * stats.triples +
      4 * stats.homeRuns;
    stats.plateAppearances =
      stats.plateAppearances ||
      stats.atBats + stats.batWalks + stats.hitByPitch + stats.sacFlys;
    const pitching = preview.pitch.filter(
      (x) =>
        normalize(x.player) === normalize(r.player) &&
        (!x.team || String(x.team) === r.label),
    );
    if (pitching.length > 1)
      throw Error(`Ambiguous pitching row for ${r.player}.`);
    if (pitching[0]) {
      const pr = pitching[0];
      for (const [key] of columns["Pitching Stats"])
        if (counts.has(key) && key !== "mvps")
          stats[key] = numeric(pr, key, "pitching");
      const ip = Number(pr.inningspitched);
      if (!Number.isFinite(ip) || ip < 0)
        throw Error("Invalid innings pitched.");
      stats.outs = Math.round(ip * 3);
    } else stats.outs = 0;
    result.push({
      player,
      team,
      positions: String(r.position)
        .split(/[\/,;→\-]+/)
        .map((x) => x.trim())
        .filter(Boolean),
      stats,
    });
  }
  if (new Set(result.map((x) => x.player)).size !== result.length)
    throw Error("A player was mapped more than once.");
  return {
    fingerprint: preview.fingerprint,
    filename: preview.filename,
    players: result,
  };
}
