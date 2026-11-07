import columns from "./temporary-stat-columns.json" with { type: "json" };
import {loadRioSheets} from './rio-spreadsheet.js';
import {extractRioInningScores,validateInningScores} from './rio-inning-scores.js';
import {resolveRioTeam,validateRioMatchup} from './rio-team-mapping.js';
import {customGameScore} from './ssl-game-score.js';
import {gamePointsForReport} from './game-points.js';
import {pitchingShutoutBonuses,pitcherShutoutStats} from './pitching-shutout.js';
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
      // Recomputed Game Score must match the TGP shown in box scores and history.
      const gp=gamePointsForReport(p);
      st.gameScore=Math.round(((st.gameScore||0)+gp.tgp+Number.EPSILON)*100)/100;
      if(typeof p.itemScore==='number'&&Number.isFinite(p.itemScore))
        st.itemScore=(st.itemScore||0)+p.itemScore;
      if(typeof p.shutoutBonus==='number'&&Number.isFinite(p.shutoutBonus))
        st.shutoutBonus=Math.round(((st.shutoutBonus||0)+p.shutoutBonus+Number.EPSILON)*100)/100;
      if(Number(p.shutoutBonus||0)>0){
        const teamPitcherCount=game.result.players.filter(q=>q.team===p.team&&Number(q.shutoutBonus||0)>0).length;
        const counts=pitcherShutoutStats(p.shutoutBonus,teamPitcherCount);
        st.shutouts=(st.shutouts||0)+counts.shutouts;
        st.combinedShutouts=(st.combinedShutouts||0)+counts.combinedShutouts;
      }
      for(const key of ['ogp','dgp','pgp','tgp'])st[key]=Math.round(((st[key]||0)+gp[key]+Number.EPSILON)*100)/100;
      st.positionsPlayed = [
        ...new Set([...st.positionsPlayed, ...(p.positions || [])]),
      ];
      stats[p.player] = st;
    }
  }
  for (const st of Object.values(stats)) {
    const ratio = (n, d) => (d ? (n || 0) / d : 0);
    st.gameScoreAvg=ratio(st.gameScore,st.gamesPlayed);
    st.agp=ratio(st.tgp,st.gamesPlayed);
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
// Shared record ordering: winning percentage, run differential, then fewer runs allowed.
// Used for both the standings and the current/historical Team Stats tables.
export function compareTeamRecords(a,b) {
  const apct=(a.wins+a.losses)?a.wins/(a.wins+a.losses):0;
  const bpct=(b.wins+b.losses)?b.wins/(b.wins+b.losses):0;
  return bpct-apct ||
    (b.runsFor-b.runsAgainst)-(a.runsFor-a.runsAgainst) ||
    a.runsAgainst-b.runsAgainst;
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
    .sort(compareTeamRecords);
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
          "completeGames",
          "shutouts",
          "combinedShutouts",
          "shutoutBonus",
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
// Project Rio's rate fields are calculated for the preview and public box
// scores, but the season-result RPC accepts *integer counting stats only*.
// Derived percentages, ERA, WHIP and innings pitched (decimal) must never be
// included in a saved report. Keep outs and complete-game counts explicitly;
// they are not regular spreadsheet counting-column keys.
const savedCountingFields=new Set([...counts,'outs','completeGames','starBases','mvps']);
export function savedReportCountingStats(stats){
  return Object.fromEntries(Object.entries(stats||{}).filter(([key])=>
    savedCountingFields.has(key)));
}
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
export async function readRio(file,season,game,players){
  const sheets=await loadRioSheets(file);
  for(const name of ['Game Info','Stats','Pitching'])
    if(!sheets[name]?.length)throw Error('Missing Project Rio '+name+' worksheet.');
  // Game Info identifies the *in-game logo/team slot*, never a draft captain.
  // It must correspond to the two teams in the selected SSL matchup.
  const resolved=validateRioMatchup(sheets['Game Info'],season.teams||[],game);
  // Never silently discard the Rio Scorecard. The saved report must carry the
  // line score so the commissioner preview and public release match exactly.
  const inningScores=extractRioInningScores(sheets['Game Info'],season.teams||[],game);
  if(!inningScores)throw Error(
    'Game Info contains no readable inning-by-inning Scorecard. '+
    'The Scorecard needs numbered inning columns and one row for each team. '+
    'Re-export the full Project Rio ODS/XLSX and upload again.'
  );
  const expectedIds=new Set([String(game.away),String(game.home)]);
  function rows(name){
    const raw=sheets[name];
    const headers=raw[0].map(x=>normalize(x));
    // Some older ODS exports contain Item Score values at column AS without
    // the header; only this known Project Rio extension column is recognized.
    if(name==='Stats'&&!headers.includes('itemscore')&&headers[44]===''&&
      raw.slice(1).some(r=>r[44]!==''&&r[44]!=null))headers[44]='itemscore';
    return raw.slice(1).map((cells,i)=>{
      const row=Object.fromEntries(headers.map((h,j)=>[h,cells[j]??'']).filter(([key])=>key));
      return {...row,row:i+2};
    });
  }
  let group='';
  const rawBat=rows('Stats').map(row=>{
    if(String(row.team??'').trim())group=String(row.team).trim();
    return {...row,team:group};
  });
  if(!rawBat.some(r=>Object.hasOwn(r,'itemscore')))
    throw Error('Add an Item Score column to Stats. A blank Item Score cell counts as zero.');
  const bat=rawBat.filter(r=>r.player&&r.position&&String(r.position).toUpperCase()!=='N/A'&&!String(r.player).includes('Totals'));
  const pitch=rows('Pitching').filter(r=>r.player&&!String(r.player).includes('Totals'));
  if(bat.length<18||bat.length>50)throw Error('Expected 18–50 participating player rows.');
  const rosters=game.frozenRosters||season.rosters||{};
  const eligible=players.filter(p=>(rosters[game.away]||[]).includes(p.id)||(rosters[game.home]||[]).includes(p.id));
  const matchingPlayers=raw=>{
    let matches=eligible.filter(p=>[p.name,...(p.rioAliases||[])].some(n=>normalize(n)===normalize(raw)));
    if(!matches.length&&String(raw).includes('Mii'))
      matches=eligible.filter(p=>p.kind==='mii'&&normalize(raw).startsWith(normalize(p.color)));
    return matches;
  };
  const teamForPlayer=p=>{
    const teams=[game.away,game.home].filter(id=>(rosters[id]||[]).includes(p.id));
    return teams.length===1?String(teams[0]):null;
  };
  const teamName=id=>(season.teams||[]).find(t=>String(t.id)===String(id))?.name||'Unknown SSL team';
  const targetRows=bat.map(row=>{
    const candidates=matchingPlayers(row.player);
    const explicit=resolveRioTeam(row.team,season.teams||[]);
    if(explicit&&!expectedIds.has(String(explicit.id)))
      throw Error('Stats sheet team '+row.team+' is not in this matchup.');
    let chosenTeam=explicit?String(explicit.id):null;
    const candidateTeams=[...new Set(candidates.map(teamForPlayer).filter(Boolean))];
    if(!chosenTeam&&candidateTeams.length===1)chosenTeam=candidateTeams[0];
    if(chosenTeam&&candidateTeams.length===1&&chosenTeam!==candidateTeams[0])
      throw Error(row.player+': the Stats team label conflicts with the SSL roster.');
    if(!chosenTeam)throw Error('Unable to determine the SSL team for '+row.player+'. Verify Game Info and the current team rosters.');
    const onTeam=candidates.filter(p=>teamForPlayer(p)===chosenTeam);
    return {...row,chosen:onTeam.length===1?onTeam[0].id:'',label:teamName(chosenTeam)};
  });
  const labels=[teamName(game.away),teamName(game.home)];
  const pitchRows=pitch.map(row=>{
    const matches=targetRows.filter(b=>normalize(b.player)===normalize(row.player));
    const explicit=resolveRioTeam(row.team,season.teams||[]);
    const selected=explicit?matches.filter(x=>x.label===explicit.name):matches;
    if(selected.length!==1)
      throw Error('Cannot identify pitcher '+row.player+' from its Stats player row. Check pitcher names or team labels.');
    return {...row,
      completegames:/^(1|yes|true)$/i.test(String(row.completegames??'').trim())?1:0,
      chosen:selected[0].chosen,label:selected[0].label};
  });
  const bytes=await file.arrayBuffer();
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
    b=>b.toString(16).padStart(2,'0')).join('');
  return {file,filename:file.name,fingerprint,labels,rows:targetRows,
    pitch:pitchRows,inningScores,
    gameInfo:resolved.map(x=>x.canonical+' → '+x.team.name)};
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
  // Official SSL credit: each Project Rio sacrifice fly adds one RBI,
  // even if the Rio RBI column already records other runs batted in.
  // Normalize ONCE while importing source rows, so the saved RBI, OGP,
  // TGP, leaderboards and box scores all use the same authoritative count.
  stats.rbi+=stats.sacFlys;
  stats.plateAppearances=stats.plateAppearances||
    stats.atBats+stats.batWalks+stats.hitByPitch+stats.sacFlys;
  if(pitchRow){
    for(const [key] of columns['Pitching Stats'])
      if(counts.has(key)&&key!=='mvps')stats[key]=reportStatCount(pitchRow,key);
    const ip=Number(pitchRow.inningspitched);
    if(!Number.isFinite(ip)||ip<0)throw Error('Invalid innings pitched.');
    stats.outs=Math.round(ip*3);
    stats.completeGames=/^(1|yes|true)$/i.test(String(pitchRow.completegames??'').trim())?1:0;
  } else {stats.outs=0;stats.completeGames=0;}
  // Preserve per-game IP and rates in both the public regular-season and
  // separately released preseason box scores; avoid inventing undefined rates.
  const ratio=(numerator,denominator)=>denominator>0?numerator/denominator:null;
  stats.inningsPitched=stats.outs/3;
  stats.battingAverage=ratio(stats.hits,stats.atBats);
  stats.onBase=ratio(stats.hits+stats.batWalks+stats.hitByPitch,stats.plateAppearances);
  stats.slug=ratio(stats.totalBases,stats.atBats);
  stats.onBasePlusSlug=stats.onBase==null||stats.slug==null?null:stats.onBase+stats.slug;
  stats.starBases=Number(row.starbaseshelper||0);
  stats.starSlug=ratio(stats.starBases,stats.starSwings);
  stats.era7=ratio(stats.earnedRuns*21,stats.outs);
  stats.era9=ratio(stats.earnedRuns*27,stats.outs);
  stats.whip=ratio((stats.hitsAllowed+stats.pitchWalks)*3,stats.outs);
  const officialAb=stats.battersFaced-stats.pitchWalks-stats.beanBalls;
  stats.baAgainst=ratio(stats.hitsAllowed,officialAb);
  stats.obAgainst=ratio(stats.hitsAllowed+stats.pitchWalks+stats.beanBalls,stats.battersFaced);
  stats.slgAgainst=ratio(stats.singlesAllowed+2*stats.doublesAllowed+3*stats.triplesAllowed+4*stats.hrAllowed,officialAb);
  stats.opsAgainst=stats.obAgainst==null||stats.slgAgainst==null?null:stats.obAgainst+stats.slgAgainst;
  return stats;
}
// Report team totals are derived from Project Rio batting runs, exactly as
// the result importer does. Bonuses are determined before automatic MVP scoring.
export function previewShutoutBonuses(preview){
  const labels=preview?.labels||[...new Set((preview?.rows||[]).map(row=>row.label))];
  if(labels.length!==2||labels[0]===labels[1])return new Map();
  const runs=labels.map(label=>(preview.rows||[]).filter(r=>r.label===label)
    .reduce((n,r)=>n+Number(r.runs||0),0));
  const pitchers=(preview.pitch||[]).map(p=>({
    player:p.chosen,team:p.label,outs:Math.round(Number(p.inningspitched||0)*3),
  })).filter(p=>p.player&&p.team&&Number.isFinite(p.outs));
  return pitchingShutoutBonuses({
    away:labels[0],home:labels[1],awayScore:runs[0],homeScore:runs[1],pitchers,
  });
}
// In seven-inning baseball the visiting team never pitches the bottom of the
// seventh if the home team already leads after the top half. A sole visiting
// pitcher with 18 outs has therefore completed ALL of his team's defensive
// innings, even when Project Rio's Complete Games cell is zero.
export function earnedSixInningCompleteGame(preview,pitcher){
  if(!pitcher||!Array.isArray(preview?.pitch)||!Array.isArray(preview?.labels)||
     preview.labels.length!==2||pitcher.label!==preview.labels[0])return false;
  const sameTeam=preview.pitch.filter(p=>p.label===pitcher.label);
  if(sameTeam.length!==1||sameTeam[0]!==pitcher||!Number(pitcher.chosen))return false;
  // The report's IP decimal is innings, not baseball's 6.1/6.2 notation:
  // require exactly eighteen retired batters, not rounded 5.99/6.01 IP.
  if(Number(pitcher.inningspitched)!==6)return false;
  const {away,home}=preview.inningScores||{};
  if(!Array.isArray(away)||!Array.isArray(home)||
     away.length!==7||home.length!==7)return false;
  if(away.some(n=>!Number.isInteger(n)||n<0)||
     home.slice(0,6).some(n=>!Number.isInteger(n)||n<0))return false;
  // Project Rio can mark an unplayed bottom seventh as X/blank (null),
  // or as a zero. Reconstruct the actual outcome rather than trusting zero.
  // A literal 0 records a played, scoreless bottom seventh. Only an
  // explicit X/blank (parsed as null) proves this half-inning was skipped.
  if(home[6]!==null)return false;
  const homeAfterSix=home.slice(0,6).reduce((sum,n)=>sum+n,0);
  const awayAfterSeven=away.reduce((sum,n)=>sum+n,0);
  return homeAfterSix>awayAfterSeven;
}
export function completeGameForReportPitcher(preview,pitcher){
  if(!pitcher)return 0;
  const rioFlag=/^(1|yes|true)$/i.test(String(pitcher.completegames??'').trim());
  return Number(rioFlag||earnedSixInningCompleteGame(preview,pitcher));
}
export function previewCustomGameScore(preview,row,mvp=null){
  const pitching=preview.pitch.filter(p=>Number(p.chosen)&&Number(p.chosen)===Number(row.chosen)
    || (normalize(p.player)===normalize(row.player)&&(!p.team||String(p.team)===row.label)));
  if(pitching.length>1)throw Error(`Ambiguous pitching row for ${row.player}.`);
  const stats=reportRowStats(row,pitching[0]);
  stats.completeGames=completeGameForReportPitcher(preview,pitching[0]);
  stats.mvps=mvp!=null&&Number(row.chosen)===Number(mvp)?1:0;
  const bonus=previewShutoutBonuses(preview).get(String(row.chosen))||0;
  return customGameScore(stats,row.itemscore===''?0:row.itemscore,bonus);
}
// Determine the MVP before adding any MVP points; only the winning team's
// highest-scoring mapped player is eligible. A tied or incomplete match gets no award.
export function automaticReportMvp(preview,awayLabel){
  if(!preview?.rows?.length||!awayLabel||preview.rows.some(r=>!Number(r.chosen)))return null;
  const totals=new Map();
  for(const row of preview.rows)totals.set(row.label,(totals.get(row.label)||0)+Number(row.runs||0));
  const labels=preview.labels||[...totals.keys()];
  if(labels.length!==2||totals.get(labels[0])===totals.get(labels[1]))return null;
  const winner=(totals.get(labels[0])||0)>(totals.get(labels[1])||0)?labels[0]:labels[1];
  const candidates=preview.rows.filter(r=>r.label===winner).map(r=>({
    player:Number(r.chosen),score:previewCustomGameScore(preview,r,null).gameScore
  }));
  candidates.sort((a,b)=>b.score-a.score||a.player-b.player);
  return candidates[0]?.player??null;
}
export function buildReport(preview, awayLabel, season, game, players, mvp) {
  const shutoutBonuses=previewShutoutBonuses(preview);
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
    stats.completeGames=completeGameForReportPitcher(preview,pitching[0]);
    stats.mvps=player===Number(mvp)?1:0;
    stats.starBases=Number(r.starbaseshelper||0);
    const shutoutBonus=shutoutBonuses.get(String(player))||0;
    const calculated=customGameScore(stats,r.itemscore===''?0:r.itemscore,shutoutBonus);
    result.push({
      player,
      team,
      gameScore:calculated.gameScore,
      baseGameScore:calculated.baseGameScore,
      itemScore:calculated.itemScore,
      shutoutBonus,
      positions: String(r.position)
        .split(/[\/,;→\-]+/)
        .map((x) => x.trim())
        .filter(Boolean),
      stats:savedReportCountingStats(stats),
    });
  }
  if (new Set(result.map((x) => x.player)).size !== result.length)
    throw Error("A player was mapped more than once.");
  for (const pitcher of preview.pitch) {
    if (completeGameForReportPitcher(preview,pitcher)===1 &&
       (preview.pitch.filter(p=>p.label===pitcher.label).length!==1 ||
        Number(pitcher.inningspitched)<=0))
      throw Error(`${pitcher.player}: a complete game requires that pitcher to throw the entire game, with no relief pitchers for the same team.`);
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
  // Never save a mismatched line score: it must equal the exact 18+ player
  // run totals after mapping Rio team labels onto the SSL away/home lineup.
  const runs=team=>result.filter(x=>String(x.team)===String(team))
    .reduce((sum,x)=>sum+Number(x.stats.runs||0),0);
  const innings=validateInningScores(preview.inningScores,runs(game.away),runs(game.home));
  return {
    fingerprint: preview.fingerprint,
    filename: preview.filename,
    players: result,
    ...(innings?{innings}:{}),
  };
}
