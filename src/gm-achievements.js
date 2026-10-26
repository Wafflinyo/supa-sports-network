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

const pitching = [
  ...series('team-strikeouts', 'Pitching', 'strike', 'pitchStrikeouts', [1,2,3,4,5],
    ['First Punchout', 'Swing and Miss', 'Strikeout Specialist', 'K Collector', 'Five-K Club'],
    'pitching strikeouts'),
  {id:'pitching-iron-arm',group:'pitch-special',category:'Pitching',icon:'arm',field:'ironArm',threshold:1,rank:6,
    name:'Iron Arm',description:'Have exactly one pitcher handle the entire completed game, without relief.'},
  {id:'pitching-superstar-reliever',group:'pitch-special',category:'Pitching',icon:'relief',field:'reliever',threshold:1,rank:7,
    name:'Superstar Reliever',description:'A substitute enters with at least five innings remaining, finishes the game, and allows two or fewer runs. Requires verified pitching-substitution details.'},
];
export const GM_ACHIEVEMENTS = Object.freeze([...wins,...offense,...defense,...pitching].map((badge,index) =>
  Object.freeze({...badge,serial:index+1})));
export const GM_ACHIEVEMENT_CATEGORIES = ['All', 'Wins', 'Offense', 'Defense', 'Pitching'];
if (GM_ACHIEVEMENTS.length !== 73 || new Set(GM_ACHIEVEMENTS.map(a=>a.id)).size !== 73)
  throw Error('GM achievements catalog must contain 73 unique badges.');

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

/** Team slots are the league's stable GM franchise identity across seasons.
 * Only released final games unlock badges. Returned entries are earned events,
 * so re-earning an achievement in another season remains visible.
 */
export function achievementProgress(seasons, slot) {
  const awards = new Map(GM_ACHIEVEMENTS.map(b=>[b.id, []]));
  if (slot==null || slot==='' || !Number.isFinite(Number(slot))) return awards;
  for (const season of seasons || []) {
    const team = season.teams?.find(t=>Number(t.slot)===Number(slot));
    if (!team) continue;
    const teamId = asId(team.id);
    const schedule = (season.games||[]).map((game,index)=>({game,index}))
      .filter(x=>asId(x.game.home)===teamId || asId(x.game.away)===teamId)
      .sort(scheduleSort);
    const regularGames = schedule.filter(x=>regular(x.game));
    const regularFinals = regularGames.filter(x=>final(x.game));
    let wins = 0, seasonHr = 0;
    const stamp=(game)=>game.releasedAt||game.result?.postedAt||game.startsAt||null;
    const award=(badge,game,player=null)=>{
      if (awards.get(badge.id).some(e=>e.seasonId===season.id&&e.gameId===game.id)) return;
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
  }
  return awards;
}
const winsBadges=GM_ACHIEVEMENTS.filter(b=>b.field==='wins');
const seasonHrBadges=GM_ACHIEVEMENTS.filter(b=>b.field==='seasonHr');
const gameBadges=GM_ACHIEVEMENTS.filter(b=>!b.season && !['ironArm','reliever'].includes(b.field));

export function earnedAchievements(seasons,slot,{seasonId='all'}={}){
  const progress=achievementProgress(seasons,slot);
  return GM_ACHIEVEMENTS.map(b=>{
    const all=progress.get(b.id)||[];
    const events=seasonId==='all'?all:all.filter(e=>String(e.seasonId)===String(seasonId));
    return {...b,earned:events.length>0,events,count:events.length,lastEarned:events.at(-1)||null};
  });
}
