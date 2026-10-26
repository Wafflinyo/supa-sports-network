// Official Sluggers Supa League GM achievement rules.
// Pure, read-only projections from *released* league results: corrections and
// history automatically flow through without a second achievement database.

const series = (group, category, icon, field, thresholds, names, noun, {individual = false, negative = false, season = false} = {}) =>
  thresholds.map((threshold, index) => ({
    id: `${group}-${threshold}`, group, category, icon, field, threshold,
    name: names[index], individual, negative, season, rank: index + 1,
    description: season
      ? `Have your team reach ${threshold} ${noun} during a single regular season.`
      : individual
        ? `Have one player record ${threshold} or more ${noun} in a single match.`
        : `Have your team record ${threshold} or more ${noun} in a single match.`,
  }));

const wins = [
  {id: 'winning-opener', group: 'wins', category: 'Wins', icon: 'flag', name: 'Opening Day Victory',
    description: "Win your team's opening regular-season matchup.", field: 'opener', threshold: 1, season: true, rank: 1},
  ...series('winning', 'Wins', 'trophy', 'wins', [1,5,10,15,20],
    ['First Dub', 'Five Alive', 'Double-Digit Dominance', 'The Contender', 'Twenty-Win Club'], 'regular-season wins', {season:true}),
  {id: 'winning-perfect', group: 'wins', category: 'Wins', icon: 'crown', name: 'Flawless Season',
    description: 'Win all 22 regular-season matches with a perfect 22–0 record.', field: 'perfect', threshold: 22, season: true, rank: 7},
];

const offense = [
  ...series('season-homer', 'Offense', 'baseball', 'seasonHr', [1,5,10,15,20,25],
    ['First Flight', 'Power Five', 'Double-Digit Dingers', 'Slugger Status', 'Home Run Factory', 'Big Bat Dynasty'],
    'team home runs', {season:true}),
  ...series('game-homer', 'Offense', 'fireball', 'gameHr', [1,3,5,7,10],
    ['Going Yard', 'Triple Threat', 'Five-Alarm Fireworks', 'Home Run Frenzy', 'Home Run Apocalypse'],
    'home runs'),
  ...series('game-runs', 'Offense', 'diamond', 'gameRuns', [1,5,10,15,20,25,30],
    ['On the Board', 'Five Across', 'Run It Up', 'Offensive Onslaught', 'Run Rampage', 'Scoring Spree', 'Scoreboard Breaker'],
    'runs scored'),
  ...series('game-rbi', 'Offense', 'star', 'gameRbi', [1,5,10,15,20,25,30],
    ['First Driven In', 'Run Producer', 'RBI Machine', 'Run-Driving Rampage', 'RBI Factory', 'Relentless Production', 'RBI Overload'],
    'team RBIs'),
];

const defense = [
  ...series('player-putouts', 'Defense', 'glove', 'putouts', [5,8,10,12,15,18,20],
    ['Glove Work', 'Sure Hands', 'Defensive Wall', 'No Fly Zone', 'Human Vacuum', 'Out Collector', 'One-Man Defense'],
    'putouts', {individual:true}),
  ...series('player-assists', 'Defense', 'hand', 'assists', [5,8,10,12,15,18,20],
    ['Helping Hand', 'Assist Artist', 'Defensive Connection', 'Precision Plays', 'Assist Machine', 'Field General', 'Defensive Maestro'],
    'defensive assists', {individual:true}),
  ...series('team-double-plays', 'Defense', 'double', 'doublePlays', [1,3,5,7,10],
    ['Two for One', 'Double Trouble', 'Twin Killing Spree', 'Double Play Dynasty', 'Double Play Masterclass'],
    'double plays'),
  ...series('team-triple-plays', 'Defense', 'triple', 'triplePlays', [1,3,5,7],
    ['Triple Threat Defense', 'Three Times the Trouble', 'Triple Play Takeover', 'Triple Play Legend'],
    'triple plays'),
  {id: 'defense-shutout', group:'shutout', category: 'Defense', icon:'shield', field:'shutout', threshold:1,
    name:'Untouchable', description:'Keep your opponent scoreless in a completed matchup (team shutout).', rank:1},
  ...series('team-buddy-jumps', 'Defense', 'wings', 'buddyJumpPutouts', [1,3,5,7,10],
    ['Dynamic Duo', 'Sky-High Chemistry', 'Airborne Defense', 'Aerial Specialists', 'Masters of the Sky'],
    'Buddy Jump putouts'),
  ...series('team-bobbles', 'Defense', 'crack', 'bobbles', [1,3,5,7,10],
    ['Butterfingers', 'Slippery Gloves', 'Fielding Fiasco', 'Defensive Disaster', 'The Butterfinger Award'],
    'bobbles', {negative:true}),
];

const postseason = [
  {id:'playoffs-qualified',group:'playoffs',category:'Playoffs',icon:'flag',field:'madePlayoffs',threshold:1,rank:1,
    name:'Postseason Bound',description:'Qualify among the eight franchises in the official playoff field.'},
  {id:'playoffs-first-win',group:'playoffs',category:'Playoffs',icon:'trophy',field:'playoffWin',threshold:1,rank:2,
    name:'Playoff Breakthrough',description:'Win an official playoff matchup.'},
  {id:'playoffs-series',group:'playoffs',category:'Playoffs',icon:'shield',field:'seriesWin',threshold:1,rank:3,
    name:'Series Conqueror',description:'Win a complete playoff round by clinching a best-of series.'},
  {id:'playoffs-semifinals',group:'playoffs',category:'Playoffs',icon:'star',field:'madeSemis',threshold:1,rank:4,
    name:'Final Four',description:'Advance into the semifinals of the SSL playoffs.'},
  {id:'playoffs-finals',group:'playoffs',category:'Playoffs',icon:'crown',field:'madeFinals',threshold:1,rank:5,
    name:'Championship Bound',description:'Earn a spot in the SSL Championship Series.'},
  {id:'playoffs-champion',group:'playoffs',category:'Playoffs',icon:'crown',field:'champion',threshold:1,rank:6,
    name:'Supa League Champion',description:'Win the best-of-five SSL Championship Series and claim the title.'},
];

const frontOffice = [
  ...series('trade-season', 'Front Office', 'exchange', 'trades', [1,5,10],
    ['First Deal', 'Trade Architect', 'Deal-Making Dynamo'],
    'approved trades in a single season', {season:true}),
  ...series('extension-player', 'Front Office', 'contract', 'playerExtensions', [1,2,3],
    ['One More Year', 'Two to Tango', 'Core Locked In'],
    'accepted player contract extensions in a single offseason', {season:true}),
  {id:'extension-stadium', group:'extension', category:'Front Office',icon:'stadium',
    field:'stadiumExtension',threshold:1,name:'Home Field Forever',rank:4,season:true,
    description:'Successfully extend the contract of a Stadium once.'},
];

const seasonHonors = [
  {id:'honors-conference',group:'honors',category:'Season Honors',icon:'crown',
    field:'conferenceChampion',name:'Conference Crown',description:'Finish first in your conference standings at the end of the regular season.'},
  {id:'honors-runs-per-game',group:'honors',category:'Season Honors',icon:'fireball',
    field:'leagueRunsPerGame',name:'Runaway Offense',description:'Lead the league in team runs scored per game over a completed regular season.'},
  {id:'honors-fewest-runs-allowed',group:'honors',category:'Season Honors',icon:'shield',
    field:'leagueFewestAllowed',name:'Lockdown League',description:'Allow the fewest runs per game in the league during a completed regular season.'},
  {id:'honors-home-runs',group:'honors',category:'Season Honors',icon:'baseball',
    field:'leagueHomeRuns',name:'Long Ball Leaders',description:'Lead all teams in home runs over a completed regular season.'},
  {id:'honors-rbis',group:'honors',category:'Season Honors',icon:'star',
    field:'leagueRbi',name:'RBI Royalty',description:'Lead all teams in RBIs over a completed regular season.'},
  {id:'honors-first-seed',group:'honors',category:'Season Honors',icon:'trophy',
    field:'firstSeed',name:'Regular Season Royalty',description:'Finish the regular season as the league-wide number-one seed.'},
];

const pitching = [
  ...series('team-strikeouts', 'Pitching', 'strike', 'pitchStrikeouts', [1,2,3,4,5],
    ['First Punchout', 'Swing and Miss', 'Strikeout Specialist', 'K Collector', 'Five-K Club'],
    'pitching strikeouts'),
  {id:'pitching-iron-arm',group:'pitch-special',category:'Pitching',icon:'arm',field:'ironArm',threshold:1,rank:6,
    name:'Iron Arm',description:'Have exactly one pitcher handle the entire completed game, without relief.'},
  {id:'pitching-superstar-reliever',group:'pitch-special',category:'Pitching',icon:'relief',field:'reliever',threshold:1,rank:7,
    name:'Superstar Reliever',description:'A substitute enters with at least five innings remaining, finishes the game, and allows two or fewer runs. Requires verified pitching-substitution details.'},
];
export const GM_ACHIEVEMENTS = Object.freeze([...wins,...offense,...defense,...pitching,...postseason,...frontOffice,...seasonHonors].map((badge,index) =>
  Object.freeze({...badge,serial:index+1})));
export const GM_ACHIEVEMENT_CATEGORIES = ['All', 'Wins', 'Offense', 'Defense', 'Pitching', 'Playoffs', 'Front Office', 'Season Honors'];
if (GM_ACHIEVEMENTS.length !== 92 || new Set(GM_ACHIEVEMENTS.map(a=>a.id)).size !== 92)
  throw Error('GM achievements catalog must contain 92 unique badges.');

const value = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
const asId = v => String(v ?? '');
const hrFor = stats => {
  // Rio 1HR/2HR/3HR indicate the number of runs on each single home run.
  // Never multiply a 3HR count by three.
  const classifications = ['oneHr','twoHr','threeHr','grandSlams']
    .reduce((n,key)=>n + value(stats[key]), 0);
  return value(stats.homeRuns) || classifications;
};
const numberFor = (row,key) => key==='gameHr'||key==='seasonHr' ? hrFor(row.stats||{}) :
  value(row.stats?.[key]);
const final = game => game?.stage==='final' && Array.isArray(game.result?.players);
const regular = game => game.phase==='regular';
const scheduleSort = (a,b) => {
  const when = g => Number.isFinite(Date.parse(g.startsAt||'')) ? Date.parse(g.startsAt) : Infinity;
  return when(a.game)-when(b.game) || a.index-b.index;
};

/** Team slots are the league's current persistent GM/franchise identity.
 * Each badge unlocks exactly ONCE across a GM's entire league career.
 * Achievements derive only from official server data and accepted transactions.
 */
export function achievementProgress(seasons, slot) {
  const awards = new Map(GM_ACHIEVEMENTS.map(b=>[b.id, []]));
  if (slot==null || slot==='' || !Number.isFinite(Number(slot))) return awards;
  const orderedSeasons=[...(seasons||[])].sort((a,b)=>
    Number(a.number??0)-Number(b.number??0) ||
    String(a.createdAt||a.id||'').localeCompare(String(b.createdAt||b.id||'')));
  for (const season of orderedSeasons) {
    const team = season.teams?.find(t=>Number(t.slot)===Number(slot));
    if (!team) continue;
    const teamId = asId(team.id);
    const schedule = (season.games||[]).map((game,index)=>({game,index}))
      .filter(x=>asId(x.game.home)===teamId || asId(x.game.away)===teamId)
      .sort(scheduleSort);
    const officialPlayoffSeries=(season.playoffSeries||[]);
    const playoffField=season.playoffTeams||[];
    const qualifies=playoffField.some(t=>asId(t?.id??t)===teamId);
    const inSeries=(round)=>officialPlayoffSeries.find(x=>x.round===round &&
      (asId(x.high)===teamId||asId(x.low)===teamId));
    const roundWon=(round)=>officialPlayoffSeries.find(x=>x.round===round && asId(x.winner)===teamId);
    const stateStarted=['postseason','retention','offseason','archived'].includes(season.status);
    const firstPlayoff=schedule.find(x=>x.game.phase==='playoffs' && final(x.game))?.game;
    // Official bracket membership is sourced from the server-owned playoff
    // field and series, not an inference from a team winning regular games.
    const representative=firstPlayoff||schedule.find(x=>final(x.game))?.game;
    const regularGames = schedule.filter(x=>regular(x.game));
    const regularFinals = regularGames.filter(x=>final(x.game));
    let wins = 0, seasonHr = 0;
    const stamp=(game)=>game.releasedAt||game.result?.postedAt||game.startsAt||null;
    const award=(badge,game,player=null)=>{
      if (!badge || awards.get(badge.id).length) return;
      awards.get(badge.id).push({
        badgeId:badge.id, seasonId:season.id, seasonName:season.name||'Season',
        teamId:team.id,teamName:team.name,gameId:game.id,earnedAt:stamp(game),
        playerId:player?.player??null, playerName:player?.name??null,
      });
    };
    for (const {game} of schedule) {
      if (!final(game)) continue;
      const rows = game.result.players.filter(p=>asId(p.team)===teamId);
      const sums = (key)=>rows.reduce((n,p)=>n+numberFor(p,key),0);
      const enemyId=asId(game.home)===teamId ? asId(game.away):asId(game.home);
      const score = value(game.result?.scores?.[teamId]);
      const enemyScore = value(game.result?.scores?.[enemyId]);
      const isRegular = regular(game);
      const gameHr=sums('gameHr');
      if(game.phase==='playoffs' && score>enemyScore)
        award(GM_ACHIEVEMENTS.find(b=>b.field==='playoffWin'),game);
      if(isRegular){
        if (score>enemyScore) wins++;
        seasonHr+=gameHr;
        for(const badge of winsBadges)if(badge.field==='wins'&&wins>=badge.threshold)
          award(badge,game);
        if(regularGames[0]?.game.id===game.id && score>enemyScore)
          award(GM_ACHIEVEMENTS.find(b=>b.field==='opener'),game);
        for(const badge of seasonHrBadges)if(seasonHr>=badge.threshold)
          award(badge,game);
        if (wins===22 && regularFinals.length===22 &&
          regularGames.length===22 && regularFinals.every(({game:g})=>{
            const own=value(g.result?.scores?.[teamId]);
            const opp=asId(g.home)===teamId?asId(g.away):asId(g.home);
            return own>value(g.result?.scores?.[opp]);
          }))
          award(GM_ACHIEVEMENTS.find(b=>b.field==='perfect'),game);
      }
      const gameValues={gameHr,gameRuns:score,gameRbi:sums('rbi'),
        doublePlays:sums('doublePlays'),triplePlays:sums('triplePlays'),
        buddyJumpPutouts:sums('buddyJumpPutouts'),bobbles:sums('bobbles'),
        pitchStrikeouts:sums('pitchStrikeouts')};
      for (const badge of gameBadges) {
        if(badge.individual){
          const scorer = rows.find(p=>numberFor(p,badge.field)>=badge.threshold);
          if(scorer) award(badge,game,scorer);
        } else if(badge.field==='shutout'){
          if(game.result?.scores?.[enemyId] != null && enemyScore===0)
            award(badge,game);
        } else if(gameValues[badge.field]>=badge.threshold) award(badge,game);
      }
      const pitchers = rows.filter(p=>['outs','pitches','battersFaced']
        .some(k=>value(p.stats?.[k])>0));
      if(pitchers.length===1)
        award(GM_ACHIEVEMENTS.find(b=>b.field==='ironArm'),game,pitchers[0]);

      // Rio's standard game totals do NOT disclose when relief occurred.
      // Do not invent a 5-innings-remaining entry point. The official result
      // may carry explicitly verified event evidence in a future reporter.
      const verified = game.result?.achievementEvidence?.superstarReliever?.[teamId];
      if(verified?.verified===true && verified?.isSubstitute===true &&
        verified?.finishedGame===true && value(verified.inningsRemainingAtEntry)>=5 &&
        Number.isFinite(Number(verified.runsAllowed)) && Number(verified.runsAllowed)<=2){
        const reliever = rows.find(p=>asId(p.player)===asId(verified.playerId));
        if(reliever && value(reliever.stats?.runsAllowed)<=2)
          award(GM_ACHIEVEMENTS.find(b=>b.field==='reliever'),game,reliever);
      }
    }
    const playoffBadge=field=>GM_ACHIEVEMENTS.find(b=>b.field===field);
    const proofGame=(series)=>schedule.find(x=>x.game.seriesId===series?.id && final(x.game))?.game
      || representative;
    // Bracket registration and round advances may happen after the most
    // recent match, so they are evaluated from the finalized series status.
    if(representative && (qualifies && stateStarted || inSeries('quarterfinal')))
      award(playoffBadge('madePlayoffs'), representative);
    if(inSeries('semifinal') && representative)
      award(playoffBadge('madeSemis'),proofGame(inSeries('semifinal')));
    if(inSeries('final') && representative)
      award(playoffBadge('madeFinals'),proofGame(inSeries('final')));
    for (const series of officialPlayoffSeries){
      if(asId(series.winner)!==teamId)continue;
      // Series winners are only authoritative when a finalized game exists in
      // the series; no prospective/preliminary brackets award titles.
      const clinch=schedule.filter(x=>x.game.seriesId===series.id && final(x.game))
        .map(x=>x.game).at(-1);
      if(!clinch)continue;
      award(playoffBadge('seriesWin'),clinch);
      if(series.round==='final')award(playoffBadge('champion'),clinch);
    }

    // Every accepted trade is one deal, even if it transfers multiple assets.
    // Incomplete or pending proposals are never part of season.transactions.
    const trades=[...new Map((season.transactions||[])
      .filter(t=>Array.isArray(t.body?.moves) && t.body.moves.some(m=>
        asId(m.from)===teamId || asId(m.to)===teamId))
      .map(t=>[String(t.id),t])).values()]
      .sort((a,b)=>Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0));
    for(const [i,trade] of trades.entries()){
      for(const badge of GM_ACHIEVEMENTS.filter(b=>b.field==='trades'&&i+1>=b.threshold))
        award(badge,{id:'approved-trade:'+trade.id,releasedAt:trade.createdAt||null});
    }

    // Contract offers are authoritative and only accepted renewals count.
    // An attempted/declined extension must never earn a badge.
    const acceptedPlayers=[...new Map((season.extensionOffers||[])
      .filter(x=>asId(x.franchise)===teamId&&x.accepted===true)
      .map(x=>[asId(x.player),x])).values()];
    for(const badge of GM_ACHIEVEMENTS.filter(b=>b.field==='playerExtensions'&&
      acceptedPlayers.length>=b.threshold))
      award(badge,{id:'player-contract:'+badge.threshold+':'+asId(acceptedPlayers[badge.threshold-1]?.attempt||acceptedPlayers[badge.threshold-1]?.player)});
    const retainedStadium=(season.stadiumExtensionOffers||[])
      .find(x=>asId(x.franchise)===teamId&&x.accepted===true);
    if(retainedStadium)award(GM_ACHIEVEMENTS.find(b=>b.field==='stadiumExtension'),
      {id:'stadium-contract:'+asId(retainedStadium.attempt||retainedStadium.stadium)});

    // Final standings are calculated server-side only when the entire
    // 12-team, 22-game regular season has been finalized and published.
    const ranking=season.finalStandings||[];
    const seasonTeams=season.teams||[];
    const complete=seasonTeams.length===12 && ranking.length===12 &&
      seasonTeams.every(t=>{
        const id=asId(t.id);
        const played=(season.games||[]).filter(g=>regular(g)&&final(g) &&
          (asId(g.home)===id||asId(g.away)===id));
        return played.length===22 &&
          played.every(g=>g.result?.scores?.[asId(g.home)]!=null &&
            g.result?.scores?.[asId(g.away)]!=null);
      });
    if(complete){
      const reference=schedule.filter(x=>regular(x.game)&&final(x.game)).at(-1)?.game;
      const top=ranking.find(t=>Number(t.rank)===1)||ranking[0];
      if(asId(top?.id)===teamId)award(GM_ACHIEVEMENTS.find(b=>b.field==='firstSeed'),reference);

      const conference=team.conference;
      const officialWinner=conference && season.conferenceChampions?.[conference];
      if(asId(officialWinner)===teamId ||
        (!officialWinner && conference && asId(ranking.find(t=>
          seasonTeams.some(z=>asId(z.id)===asId(t.id)&&z.conference===conference))?.id)===teamId))
        award(GM_ACHIEVEMENTS.find(b=>b.field==='conferenceChampion'),reference);

      // All 12 teams have the same 22-match denominator.
      // Tied leaders each qualify, using the exact unrounded statistics.
      const leaders=seasonTeams.map(t=>{
        const tid=asId(t.id);
        const played=season.games.filter(g=>regular(g)&&final(g)&&
          (asId(g.home)===tid||asId(g.away)===tid));
        return {id:tid, runs:played.reduce((n,g)=>n+value(g.result.scores[tid]),0),
          allowed:played.reduce((n,g)=>n+value(g.result.scores[
            asId(g.home)===tid?asId(g.away):asId(g.home)]),0),
          homers:played.reduce((n,g)=>n+g.result.players.filter(p=>
            asId(p.team)===tid).reduce((q,p)=>q+hrFor(p.stats||{}),0),0),
          rbi:played.reduce((n,g)=>n+g.result.players.filter(p=>
            asId(p.team)===tid).reduce((q,p)=>q+value(p.stats?.rbi),0),0)};
      });
      const topFor=(key,ascending=false)=>ascending
        ?Math.min(...leaders.map(t=>t[key])):Math.max(...leaders.map(t=>t[key]));
      const self=leaders.find(x=>x.id===teamId);
      for(const [field,key,ascending] of [
        ['leagueRunsPerGame','runs',false],['leagueFewestAllowed','allowed',true],
        ['leagueHomeRuns','homers',false],['leagueRbi','rbi',false]]){
        if(self?.[key]===topFor(key,ascending))
          award(GM_ACHIEVEMENTS.find(b=>b.field===field),reference);
      }
    }
  }
  return awards;
}
const winsBadges=GM_ACHIEVEMENTS.filter(b=>b.field==='wins');
const seasonHrBadges=GM_ACHIEVEMENTS.filter(b=>b.field==='seasonHr');
const gameBadges=GM_ACHIEVEMENTS.filter(b=>!b.season && ![
  'ironArm','reliever','madePlayoffs','playoffWin','seriesWin','madeSemis',
  'madeFinals','champion','conferenceChampion','leagueRunsPerGame',
  'leagueFewestAllowed','leagueHomeRuns','leagueRbi','firstSeed'
].includes(b.field));

export function earnedAchievements(seasons,slot,{seasonId='all'}={}){
  const progress=achievementProgress(seasons,slot);
  return GM_ACHIEVEMENTS.map(b=>{
    const all=progress.get(b.id)||[];
    // Lifetime collection never resets when browsing an older/newer season.
    // The selected season only determines whether its first unlock is shown.
    const events=all;
    return {...b,earned:events.length>0,
      earnedInSelectedSeason:seasonId==='all'||all.some(e=>String(e.seasonId)===String(seasonId)),
      events,count:events.length,lastEarned:events[0]||null};
  });
}
