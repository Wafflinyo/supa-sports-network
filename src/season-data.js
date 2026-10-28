import columns from "./temporary-stat-columns.json" with { type: "json" };
import {customGameScore} from './ssl-game-score.js';
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
      ? s.games.filter(g=>g.startsAt).map((g) => ({
          id: "ssl:" + g.id,
          seasonId: s.id,
          phase: g.phase,
          startsAt: g.startsAt,
          playerScores: Object.fromEntries(
            (g.stage === "final" ? g.result?.players || [] : []).map((p) => [
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
      if(typeof p.gameScore==='number'&&Number.isFinite(p.gameScore))
        st.gameScore=(st.gameScore||0)+p.gameScore;
      if(typeof p.itemScore==='number'&&Number.isFinite(p.itemScore))
        st.itemScore=(st.itemScore||0)+p.itemScore;
      st.positionsPlayed = [
        ...new Set([...st.positionsPlayed, ...(p.positions || [])]),
      ];
      stats[p.player] = st;
    }
  }
  for (const st of Object.values(stats)) {
    const ratio = (n, d) => (d ? (n || 0) / d : 0);
    st.gameScoreAvg=ratio(st.gameScore,st.gamesPlayed);
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
export function matchupType(season,game){
  const a=season?.teams?.find(t=>t.id===game?.away),b=season?.teams?.find(t=>t.id===game?.home);
  if(!a?.conference||!b?.conference)return 'Conference Pending';
  return a.conference===b.conference?'In Conference Matchup':'Out of Conference Matchup';
}
export function standings(season) {
  return (season?.teams || [])
    .map((t) => {
      let wins=0,losses=0,homeWins=0,homeLosses=0,awayWins=0,awayLosses=0,
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
        if(a>b){wins++;if(g.home===t.id)homeWins++;else awayWins++;}
        else if(a<b){losses++;if(g.home===t.id)homeLosses++;else awayLosses++;}
      }
      return {
        ...t,
        wins,
        losses,
        homeWins,homeLosses,awayWins,awayLosses,
        runsFor,
        runsAgainst,
        pct: wins + losses ? wins / (wins + losses) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.pct - a.pct ||
        b.runsFor - b.runsAgainst - (a.runsFor - a.runsAgainst) ||
        a.runsAgainst - b.runsAgainst,
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
  const rawBat = rows("Stats");
  if(!rawBat.some(r=>Object.hasOwn(r,'itemscore')))
    throw Error('Add an "Item Score" column to the Project Rio Stats worksheet. Enter points there; blank cells count as zero. The website calculates Game Score automatically.');
  const bat = rawBat.filter(
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
    pitch: pitch.map((r) => {
      const matches = targetRows.filter(
        (b) =>
          normalize(b.player) === normalize(r.player) &&
          (!r.team || String(r.team) === b.label),
      );
      return {
        ...r,
        label: String(r.team || matches[0]?.label || ""),
        chosen: matches.length === 1 ? matches[0].chosen : "",
      };
    }),
  };
}
export function reportStatCount(r,key) {
  const label = Object.values(columns).flat().find(([k]) => k === key)?.[1];
  const names = aliases[key] || [label || key];
  const match = names.map(normalize).find((n) => r?.[n] != null && r[n] !== "");
  if (!match)return 0;
  const n=Number(r[match]);
  if(!Number.isInteger(n)||n<0)throw Error(`${r.player}: invalid ${label||key}`);
  return n;
}
export function reportRowStats(row,pitchRow=null){
  const stats=Object.fromEntries([...counts].map(k=>[k,0]));
  for(const [key] of [...columns['Offensive Stats'],...columns['Defensive Stats']])
    if(counts.has(key)&&key!=='mvps')stats[key]=reportStatCount(row,key);
  stats.totalBases=stats.singles+2*stats.doubles+3*stats.triples+4*stats.homeRuns;
  stats.plateAppearances=stats.plateAppearances||
    stats.atBats+stats.batWalks+stats.hitByPitch+stats.sacFlys;
  if(pitchRow){
    for(const [key] of columns['Pitching Stats'])
      if(counts.has(key)&&key!=='mvps')stats[key]=reportStatCount(pitchRow,key);
    const ip=Number(pitchRow.inningspitched);
    if(!Number.isFinite(ip)||ip<0)throw Error('Invalid innings pitched.');
    stats.outs=Math.round(ip*3);
  } else stats.outs=0;
  return stats;
}
export function previewCustomGameScore(preview,row){
  const pitching=preview.pitch.filter(p=>Number(p.chosen)&&Number(p.chosen)===Number(row.chosen)
    || (normalize(p.player)===normalize(row.player)&&(!p.team||String(p.team)===row.label)));
  if(pitching.length>1)throw Error(`Ambiguous pitching row for ${row.player}.`);
  return customGameScore(reportRowStats(row,pitching[0]),row.itemscore===''?0:row.itemscore);
}
export function buildReport(preview, awayLabel, season, game, players, mvp) {
  const pickTeam = (r) => (r.label === awayLabel ? game.away : game.home),
    result = [];
  for (const r of preview.rows) {
    const player = Number(r.chosen),
      team = pickTeam(r);
    if (!player || !rosterOf(season, team).includes(player))
      throw Error(`Map ${r.player} to a player from the correct team.`);
    const pitching = preview.pitch.filter((x) => Number(x.chosen) === player);
    if (pitching.length > 1)
      throw Error(`Ambiguous pitching row for ${r.player}.`);
    const stats=reportRowStats(r,pitching[0]);
    stats.mvps=player===Number(mvp)?1:0;
    stats.starBases=Number(r.starbaseshelper||0);
    const calculated=customGameScore(stats,r.itemscore===''?0:r.itemscore);
    result.push({
      player,
      team,
      gameScore:calculated.gameScore,
      baseGameScore:calculated.baseGameScore,
      itemScore:calculated.itemScore,
      positions: String(r.position)
        .split(/[\/,;→\-]+/)
        .map((x) => x.trim())
        .filter(Boolean),
      stats,
    });
  }
  if (new Set(result.map((x) => x.player)).size !== result.length)
    throw Error("A player was mapped more than once.");
  for (const pitcher of preview.pitch) {
    if (
      !pitcher.chosen ||
      !result.some(
        (p) =>
          p.player === Number(pitcher.chosen) && p.team === pickTeam(pitcher),
      )
    )
      throw Error(
        `Map pitching row ${pitcher.row} (${pitcher.player}) to the correct participating player.`,
      );
  }
  return {
    fingerprint: preview.fingerprint,
    filename: preview.filename,
    players: result,
  };
}
