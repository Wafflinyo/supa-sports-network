import {HEATING_UP_THRESHOLD} from './heating-up.js';
import {preseasonChampionshipFeature} from './preseason-champion-feature.js';
import {matchHeadline,gameOutcomeContext} from './game-headlines.js';
// Derived newsroom: headlines refresh when official reports are corrected.
// Recorded games remain commissioner-only until their results are released.

const amount = value => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};
const plural = (count, singular, pluralForm = singular + 's') =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// Keep copy varied but stable: refreshing a page must not reshuffle headlines.
function wording(gameId, playerId, category, tier, alternatives) {
  const seed = `${gameId}:${playerId}:${category}:${tier}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) >>> 0;
  return alternatives[hash % alternatives.length];
}

function homerDetails(stats) {
  // Rio's 1HR, 2HR and 3HR are *one-, two- and three-run* home runs.
  // Their cell values are event counts, not home run multipliers.
  const groups = [
    ['oneHr', 'solo home run'],
    ['twoHr', 'two-run home run'],
    ['threeHr', 'three-run home run'],
    ['grandSlams', 'grand slam'],
  ];
  const events = groups
    .map(([key, label]) => ({count: amount(stats[key]), label, key}))
    .filter(x => x.count > 0);
  const classifiedCount = events.reduce((sum, event) => sum + event.count, 0);
  // Historic reports may have only the total Home Runs column.
  const total = classifiedCount > 0 ? classifiedCount : amount(stats.homeRuns);
  return {total, events};
}

function pitchingDetail(stats) {
  // Rio's innings are recorded as outs (three outs = one inning).
  // Avoid floating-point "5.1 innings" mistakes: 5.1 means 5 IP + 1 out.
  const outs = amount(stats.outs);
  return {outs, innings: `${Math.floor(outs / 3)}.${outs % 3}`,
    runsAllowed: amount(stats.runsAllowed),
    strikeouts: amount(stats.pitchStrikeouts)};
}

// A team gets one collective performance post for a matchup when multiple
// teammates qualify. Every qualifying highlight is retained, but each player
// is introduced once rather than generating competing standalone posts.
export function consolidateTeammateNews(items,seasons,players=[]){
  const groups=new Map();
  const eligible=new Set(['heating','home-run','offense','defense','pitching','perfect-batting']);
  for(const item of items){
    if(!eligible.has(item.category)||!item.gameId||!item.teamId)continue;
    const key=String(item.seasonId||item.season)+':'+item.gameId+':'+item.teamId;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item);
  }
  const replacements=new Map(),remove=new Set();
  const nameById=new Map(players.map(p=>[Number(p.id),p.name]));
  for(const [key,group] of groups){
    const distinct=[...new Set(group.map(x=>x.playerId).filter(x=>x!=null))];
    if(distinct.length<2)continue;
    const representative=group[0];
    const season=(seasons||[]).find(s=>
      String(s.id)===String(representative.seasonId)||
      s.name===representative.season);
    const game=season?.games?.find(g=>String(g.id)===String(representative.gameId));
    const home=(season?.teams||[]).find(t=>String(t.id)===String(representative.teamId));
    if(!game||!home||game.stage!=='final')continue;
    const byPlayer=new Map();
    for(const item of group){
      if(!byPlayer.has(item.playerId))byPlayer.set(item.playerId,[]);
      byPlayer.get(item.playerId).push(item);
    }
    const remarks=[...byPlayer].map(([id,stories])=>{
      const person=nameById.get(Number(id))||'A player';
      const details=stories.map(item=>item.summary.replace(/\s+against\s+.+?(?:\.|$)/i,'.').trim())
        .map(x=>x.replace(/[. ]+$/,'')).filter(Boolean);
      return person+': '+details.join('; ')+'.';
    });
    const closing='All of it happened '+gameOutcomeContext(season,game,representative.teamId);
    const combined={
      ...representative,
      id:'team-game:'+key,category:'team-game',tier:'teammates',label:'TEAM GAME STANDOUTS',
      title:distinct.map(id=>nameById.get(Number(id))||'A player').join(', ')+
        ' lead '+home.name+' in a standout team effort!',
      summary:remarks.join(' ')+' '+closing,
      seasonId:season.id,playerId:null,gameId:game.id,
      collectivePlayers:distinct,private:false,
    };
    replacements.set(representative.id,combined);
    for(const item of group)remove.add(item.id);
  }
  const output=[];
  for(const item of items){
    if(replacements.has(item.id))output.push(replacements.get(item.id));
    else if(!remove.has(item.id))output.push(item);
  }
  return output;
}

export function leagueNews(seasons, players, {includeRecorded = false} = {}) {
  const pool = new Map(players.map(p => [Number(p.id), p.name]));
  const items = [];
  for (const season of seasons || []) {
    const teamName = id => season.teams?.find(t => t.id === id)?.name || 'the opposing team';
    for (const game of season.games || []) {
      if (!(game.stage === 'final' || (includeRecorded && game.stage === 'recorded'))) continue;
      // Only released, score-verified matches qualify for the public headline
      // newsroom. Private staged reports are NEVER carousel candidates.
      const story=matchHeadline(season,game,players);
      if(story)items.push(story);
      if (!Array.isArray(game.result?.players))continue;
      const at = game.releasedAt || game.result.postedAt || game.startsAt;
      for (const row of game.result.players) {
        const playerId = Number(row.player);
        const player = pool.get(playerId) || 'A player';
        const stats = row.stats || {};
        const opponent = teamName(row.team === game.away ? game.home : game.away);
        const score = Number(row.gameScore);
        const key = `game:${game.id}:${playerId}`;
        const headline = (category, tier, alternatives) =>
          wording(game.id, playerId, category, tier, alternatives);
        const add = (category, tier, label, title, summary) => items.push({
          id: `${key}:${category}`, category, tier, label, title, summary, at,
          season: season.name, seasonId: season.id, gameId: game.id, playerId, teamId: row.team,
          private: game.stage === 'recorded',
        });

        if (row.gameScore != null && Number.isFinite(score) && score >= HEATING_UP_THRESHOLD)
          add('heating', 'hot', 'HEATING UP', `${player} is heating up!`,
            `A ${score} Game Score against ${opponent} earns ${player} a star for the next team game.`);

        const homers = homerDetails(stats);
        if (homers.total >= 1) {
          const {total, events} = homers;
          const grandSlam = events.some(e => e.key === 'grandSlams');
          const threeRun = events.some(e => e.key === 'threeHr');
          const twoRun = events.some(e => e.key === 'twoHr');
          const tier = total >= 3 ? 'three-plus' : total === 2 ? 'multi'
            : grandSlam ? 'grand-slam' : threeRun ? 'three-run'
            : twoRun ? 'two-run' : 'solo';
          const labels = {
            'three-plus': 'HOME RUN BARRAGE', multi: 'MULTI-HR PERFORMANCE',
            'grand-slam': 'GRAND SLAM', 'three-run': 'THREE-RUN HOMER',
            'two-run': 'TWO-RUN HOMER', solo: 'HOME RUN',
          };
          const choices = {
            'three-plus': [
              `${player} goes on a home-run tear!`,
              `${player} launches ${total} home runs!`,
              `${player} puts on a power-hitting show!`,
            ],
            multi: [
              `${player} blasts ${total} home runs!`,
              `${player} goes deep twice!`,
              `${player} delivers a multi-homer game!`,
            ],
            'grand-slam': [
              `${player} clears the bases with a grand slam!`,
              `${player} launches a grand slam!`,
              `${player} brings everyone home with one swing!`,
            ],
            'three-run': [
              `${player} unloads a three-run blast!`,
              `${player} sends a three-run shot over the wall!`,
              `${player} drives in three with a homer!`,
            ],
            'two-run': [
              `${player} launches a two-run homer!`,
              `${player} delivers a two-run blast!`,
              `${player} brings two home with one swing!`,
            ],
            solo: [
              `${player} goes deep!`,
              `${player} belts a solo shot!`,
              `${player} sends one out of the park!`,
            ],
          };
          const detail = events.length
            ? ' Featuring ' + events.map(e =>
                `${e.count} ${e.label}${e.count === 1 ? '' : 's'}`).join(', ') + '.'
            : '';
          add('home-run', tier, labels[tier],
            headline('home-run', tier, choices[tier]),
            `${plural(total, 'home run')} against ${opponent}.${detail}`);
        }

        const runs = amount(stats.runs), rbi = amount(stats.rbi);
        const production = runs + rbi;
        if (production >= 5) {
          const tier = production >= 11 ? 'elite' : production >= 8 ? 'outstanding' : 'good';
          add('offense', tier,
            tier === 'good' ? 'GOOD OFFENSIVE OUTING' :
            tier === 'outstanding' ? 'OUTSTANDING OFFENSIVE OUTING' : 'EXCEPTIONAL OFFENSIVE OUTING',
            headline('offense', tier, tier === 'good'
              ? [`${player} delivers a strong offensive outing!`, `${player} sparks the attack!`, `${player} contributes at the plate!`]
              : tier === 'outstanding'
              ? [`${player} powers an outstanding offensive outing!`, `${player} takes over offensively!`, `${player} delivers a huge game at the plate!`]
              : [`${player} puts on an offensive masterclass!`, `${player} has a monster day at the plate!`, `${player} leads an incredible offensive display!`]),
            `${plural(runs, 'run')} scored and ${rbi} RBI against ${opponent} — ${production} combined runs and RBI.`);
        }

        const defenseKeys = ['putouts', 'assists', 'doublePlays', 'triplePlays', 'buddyJumpPutouts'];
        const defense = defenseKeys.reduce((sum, k) => sum + amount(stats[k]), 0);
        if (defense >= 8) {
          const tier = defense >= 15 ? 'elite' : defense >= 11 ? 'outstanding' : 'good';
          add('defense', tier,
            tier === 'good' ? 'GOOD DEFENSIVE OUTING' :
            tier === 'outstanding' ? 'OUTSTANDING DEFENSIVE OUTING' : 'EXCEPTIONAL DEFENSIVE OUTING',
            headline('defense', tier, tier === 'good'
              ? [`${player} gets it done with the glove!`, `${player} turns in a strong defensive game!`, `${player} makes a difference in the field!`]
              : tier === 'outstanding'
              ? [`${player} puts on a defensive clinic!`, `${player} shines all game in the field!`, `${player} anchors an outstanding defensive performance!`]
              : [`${player} puts on a defensive masterclass!`, `${player} dominates defensively!`, `${player} turns in a spectacular fielding performance!`]),
            `${defense} combined putouts, assists, double plays, triple plays and Buddy Jump putouts against ${opponent}.`);
        }

        const pitch = pitchingDetail(stats);
        if (pitch.outs >= 15 && pitch.runsAllowed <= 3) {
          // Zero Ks still qualifies: innings and runs allowed are the only gates.
          const tier = pitch.runsAllowed === 0 ? 'scoreless'
            : pitch.runsAllowed === 1 ? 'outstanding'
            : pitch.runsAllowed === 2 ? 'strong' : 'solid';
          add('pitching', tier,
            tier === 'scoreless' ? 'DOMINANT PITCHING OUTING' :
            tier === 'outstanding' ? 'OUTSTANDING PITCHING OUTING' :
            tier === 'strong' ? 'STRONG PITCHING OUTING' : 'SOLID PITCHING OUTING',
            headline('pitching', tier, tier === 'scoreless'
              ? [`${player} shuts down the opposition!`, `${player} delivers scoreless pitching!`, `${player} keeps the scoreboard clean!`]
              : tier === 'outstanding'
              ? [`${player} delivers a stellar outing on the mound!`, `${player} is sharp from start to finish!`, `${player} shines on the mound!`]
              : tier === 'strong'
              ? [`${player} turns in a strong pitching performance!`, `${player} keeps hitters under control!`, `${player} delivers on the mound!`]
              : [`${player} puts together a solid pitching outing!`, `${player} keeps the game in check!`, `${player} holds the opposition to three runs!`]),
            `${pitch.innings} IP, ${plural(pitch.strikeouts, 'strikeout')}, ${plural(pitch.runsAllowed, 'run')} allowed against ${opponent}.`);
        }

        // Use the same on-base events and PA denominator as the site's stats.
        // A perfect outing means reaching base on EVERY plate appearance,
        // with at least two appearances so that a lone walk is not a highlight.
        const hits = stats.hits != null ? amount(stats.hits) :
          ['singles', 'doubles', 'triples'].reduce((sum, k) => sum + amount(stats[k]), 0) + homers.total;
        const walks = amount(stats.batWalks), hitByPitch = amount(stats.hitByPitch);
        const reached = hits + walks + hitByPitch;
        const pa = amount(stats.plateAppearances) ||
          amount(stats.atBats) + walks + hitByPitch + amount(stats.sacFlys);
        if (pa >= 2 && reached === pa) {
          const tier = pa >= 6 ? 'elite' : pa >= 4 ? 'outstanding' : 'solid';
          add('perfect-batting', tier,
            tier === 'solid' ? 'PERFECT ON-BASE OUTING' :
            tier === 'outstanding' ? 'OUTSTANDING ON-BASE OUTING' : 'FLAWLESS ON-BASE OUTING',
            headline('perfect-batting', tier, tier === 'solid'
              ? [`${player} reaches base every time!`, `${player} goes perfect getting on base!`, `${player} never makes an out at the plate!`]
              : tier === 'outstanding'
              ? [`${player} simply cannot be kept off base!`, `${player} delivers a perfect on-base performance!`, `${player} reaches safely in every plate appearance!`]
              : [`${player} puts on a flawless on-base clinic!`, `${player} has a remarkable perfect day at the plate!`, `${player} is unstoppable at the plate!`]),
            `${reached}-for-${pa} reaching base against ${opponent}: ${plural(hits, 'hit')}, ${plural(walks, 'walk')} and ${plural(hitByPitch, 'hit by pitch', 'hit by pitches')}.`);
        }
      }
    }
    // Announce the championship from public released finals, never from a
    // commissioner-only staged spreadsheet. Rebuilt deterministically on reload.
    const championship=preseasonChampionshipFeature(season,players);
    if(championship){
      const leaders=championship.topPlayers.map(row=>
        `${row.name} (${row.agp.toFixed(2)} AGP)`).join(', ');
      items.push({
        id:`preseason-champion:${season.id}`,
        category:'preseason-champion',tier:'champion',
        label:'PRESEASON CHAMPIONS',season:season.name,
        title:`${championship.champion.name} win the ${championship.seasonName} preseason championship!`,
        summary:leaders
          ?`${championship.champion.name} are the ${championship.seasonName} preseason champions! Top players by average Game Points: ${leaders}. Explore the full tournament results and statistics.`
          :`${championship.champion.name} are the ${championship.seasonName} preseason champions! Explore the full tournament results and statistics.`,
        at:championship.at||'',
        seasonId:season.id,
      });
    }
    for (const trade of season.transactions || []) {
      const moves = trade.body?.moves || [];
      // season.transactions contains approved trades only.
      if (!moves.length) continue;
      const playerMoves = moves.filter(move => move.kind === 'player');
      const first = playerMoves[0];
      const from = first?.from || moves[0]?.from;
      const to = first?.to || moves[0]?.to;
      const teamIds = [...new Set([
        ...(trade.body?.teams || []),
        ...moves.flatMap(move => [move.from, move.to]),
      ].filter(Boolean))];

      // The structured breakdown is shared by the news feed, and works for
      // uneven exchanges, draft picks, and even three-way trades.
      const received = new Map();
      for (const move of moves) {
        if (!move.to) continue;
        const items = received.get(move.to) || [];
        let label = 'Legacy asset';
        if (move.kind === 'player') {
          label = pool.get(Number(move.id)) || 'Unknown player';
        } else if (move.kind === 'pick') {
          const asset = (season.pickAssets || []).find(p => String(p.id) === String(move.id));
          const seasonNumber = season.tradePickSeason || (Number(season.number || 0) + 1);
          label = `Season ${seasonNumber} · Round ${asset?.round || '?'} draft pick`;
          if (asset?.originalTeam) label += ` (originally ${teamName(asset.originalTeam)})`;
        }
        items.push({kind: move.kind, label, from: teamName(move.from)});
        received.set(move.to, items);
      }
      const tradeGroups = [...received].map(([teamId, assets]) => ({
        teamId, teamName: teamName(teamId), assets,
      }));
      const headline = moves.length === 1 && first && from && to
        ? `${teamName(from)} trades ${pool.get(Number(first.id)) || 'a player'} to ${teamName(to)}!`
        : teamIds.length === 2
          ? `${teamName(teamIds[0])} & ${teamName(teamIds[1])} complete a trade!`
          : `${teamIds.length} SSL teams complete a trade!`;
      const description = tradeGroups.map(group =>
        `${group.assets.length} ${group.assets.length === 1 ? 'asset' : 'assets'} to ${group.teamName}`
      ).join(' · ');
      items.push({
        id: `trade:${trade.id}`, category: 'trade', label: 'TRADE APPROVED',
        title: headline, summary: description, tradeGroups, at: trade.createdAt || '',
        season: season.name, tradeId: trade.id,
      });
    }
  }
  const validDate = time => Number.isFinite(Date.parse(time || '')) ? Date.parse(time) : 0;
  return consolidateTeammateNews(items,seasons,players)
    .sort((a, b) => validDate(b.at) - validDate(a.at) || a.id.localeCompare(b.id));
}
