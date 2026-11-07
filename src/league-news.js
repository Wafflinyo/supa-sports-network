import {HEATING_UP_THRESHOLD} from './heating-up.js';
import {gamePointsForReport} from './game-points.js';
import {preseasonChampionshipFeature} from './preseason-champion-feature.js';
import {matchHeadline,gameOutcomeContext,pitchingNewsPerformance} from './game-headlines.js';
import {reporterParagraph} from './reporter-copy.js';
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


// Group recognition by the SAME season, team and game. Heating Up remains a
// separate class of news and is only combined when two or more teammates
// heat up together. One player earning multiple stat achievements also gets
// ONE recognition article instead of duplicate home run/offense/etc posts.
// The rule is identical for the commissioner's unreleased previews, which
// MUST retain the private flag after grouping.
export function consolidateTeammateNews(items,seasons,players=[]){
  const recognized=new Set(['home-run','offense','defense','pitching','perfect-batting']);
  const names=new Map(players.map(p=>[Number(p.id),p.name]));
  const groups=new Map();
  for(const item of items){
    const type=item.category==='heating'?'heating':recognized.has(item.category)?'stats':null;
    if(!type||item.gameId==null||item.teamId==null)continue;
    const key=[item.seasonId??item.season,item.gameId,item.teamId,type].join(':');
    if(!groups.has(key))groups.set(key,{key,type,items:[]});
    groups.get(key).items.push(item);
  }
  const replacements=new Map(),removed=new Set();
  for(const group of groups.values()){
    const batch=group.items;
    const uniquePlayers=[...new Set(batch.map(x=>Number(x.playerId)))];
    // Stats combine when one player has two or more accomplishments OR
    // teammates each have achievements. Heating combines ONLY for teammates.
    if(group.type==='stats'&&batch.length<2)continue;
    if(group.type==='heating'&&uniquePlayers.length<2)continue;
    const first=batch[0];
    const season=(seasons||[]).find(s=>
      (first.seasonId!=null&&String(s.id)===String(first.seasonId))||
      (first.seasonId==null&&s.name===first.season));
    const game=season?.games?.find(g=>String(g.id)===String(first.gameId));
    const team=season?.teams?.find(t=>String(t.id)===String(first.teamId));
    if(!game||!team||!['recorded','final'].includes(game.stage))continue;
    const opponentId=String(game.away)===String(first.teamId)?game.home:game.away;
    const opponent=season.teams.find(t=>String(t.id)===String(opponentId))?.name||
      'the opposing team';
    const summaryEnd=gameOutcomeContext(season,game,first.teamId);
    const playerGroups=new Map();
    for(const item of batch){
      const id=Number(item.playerId);
      if(!playerGroups.has(id))playerGroups.set(id,[]);
      playerGroups.get(id).push(item);
    }
    const rosterNames=uniquePlayers.map(id=>names.get(id)||'A player');
    const teamRuns=Number(game.result?.scores?.[first.teamId]);
    const opponentRuns=Number(game.result?.scores?.[opponentId]);
    const lost=Number.isFinite(teamRuns)&&Number.isFinite(opponentRuns)&&teamRuns<opponentRuns;
    const week=Number(game.week);
    const featuredNames=rosterNames.length===1?rosterNames[0]:
      rosterNames.slice(0,-1).join(', ')+(rosterNames.length>2?', and ':' and ')+rosterNames.at(-1);
    // Recognize the players despite the result; avoid the deflating
    // "in Week X's loss" phrasing after a positive list of achievements.
    const closing=lost
      ? 'Despite their defeat against the '+opponent+
        (Number.isInteger(week)&&week>0?' in Week '+week:'')+
        ', '+featuredNames+' still delivered '+(rosterNames.length===1?'a standout performance':'standout performances')+'.'
      : summaryEnd.charAt(0).toUpperCase()+summaryEnd.slice(1);
    let combined;
    if(group.type==='heating'){
      const details=uniquePlayers.map(id=>{
        const name=names.get(id)||'A player';
        const row=game.result?.players?.find(r=>
          Number(r.player)===id&&String(r.team)===String(first.teamId));
        const score=row?gamePointsForReport(row).tgp:NaN;
        return name+(Number.isFinite(score)?' ('+score+' Game Score)':'');
      });
      combined={
        ...first,id:'team-heating:'+group.key,category:'heating',tier:'hot',
        label:'HEATING UP',playerId:null,collectivePlayers:uniquePlayers,
        title:rosterNames.join(' and ')+' are heating up!',
        summary:details.join(' · ')+'. These teammates earned a fire for the next game. '+closing,
        private:game.stage==='recorded',
      };
    }else{
      const details=[...playerGroups].map(([id,events],index)=>{
        const person=names.get(id)||'A player';
        const report=reporterParagraph(person,id,events.map(e=>e.category),
          game,first.teamId,opponent,team.name,index);
        return '• '+(report||person+' had a standout performance.');
      });
      combined={
        ...first,id:'team-game:'+group.key,category:'team-game',tier:'teammates',
        label:uniquePlayers.length===1?'GAME PERFORMANCE':'TEAM GAME STANDOUTS',
        title:uniquePlayers.length===1
          ?rosterNames[0]+' delivers a standout performance for '+team.name+'!'
          :rosterNames.length>3
            ?rosterNames.slice(0,2).join(', ')+' and '+(rosterNames.length-2)+' teammates shine for '+team.name+'!'
            :rosterNames.join(', ')+' shine for '+team.name+'!',
        summary:details.join('\n'),
        playerId:null,collectivePlayers:uniquePlayers,
        recognitions:batch.map(({playerId,category,tier,label,title,summary})=>
          ({playerId,category,tier,label,title,summary})),
        private:game.stage==='recorded',
      };
    }
    replacements.set(first.id,combined);
    for(const item of batch)removed.add(item.id);
  }
  const output=[];
  for(const item of items){
    if(replacements.has(item.id))output.push(replacements.get(item.id));
    else if(!removed.has(item.id))output.push(item);
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
      const story=matchHeadline(season,game,players,{includeRecorded});
      if(story)items.push(story);
      if (!Array.isArray(game.result?.players))continue;
      const at = game.releasedAt || game.result.postedAt || game.startsAt;
      for (const row of game.result.players) {
        const playerId = Number(row.player);
        const player = pool.get(playerId) || 'A player';
        const stats = row.stats || {};
        const opponent = teamName(row.team === game.away ? game.home : game.away);
        const score = gamePointsForReport(row).tgp;
        const key = `game:${game.id}:${playerId}`;
        const headline = (category, tier, alternatives) =>
          wording(game.id, playerId, category, tier, alternatives);
        const add = (category, tier, label, title, summary) => items.push({
          id: `${key}:${category}`, category, tier, label, title,
          summary: ['home-run','offense','defense','pitching','perfect-batting'].includes(category)
            ? reporterParagraph(player,playerId,[category],game,row.team,opponent,teamName(row.team))||summary
            : summary, at,
          season: season.name, seasonId: season.id, gameId: game.id, playerId, teamId: row.team,
          private: game.stage === 'recorded',
        });

        if (Number.isFinite(score) && score >= HEATING_UP_THRESHOLD)
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
            `${[runs>0?plural(runs,'run')+' scored':null,rbi>0?plural(rbi,'RBI','RBI'):null].filter(Boolean).join(' and ')} against ${opponent} — ${production} combined runs and RBI.`);
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
            `${defense} total fielding plays (${defenseKeys.filter(key=>amount(stats[key])>0).map(key=>plural(amount(stats[key]),({putouts:'putout',assists:'assist',doublePlays:'double play',triplePlays:'triple play',buddyJumpPutouts:'Buddy Jump putout'})[key])).join(', ')}) against ${opponent}.`);
        }

        const pitch=pitchingNewsPerformance(row,game);
        if(pitch) {
          const label=pitch.shutout?'SHUTOUT PITCHING PERFORMANCE':
            pitch.tier==='great'?'GREAT PITCHING OUTING':
            pitch.tier==='solid'?'SOLID PITCHING OUTING':
            pitch.tier==='good'?'GOOD PITCHING OUTING':
            'STRONG RUN PREVENTION';
          const title=pitch.shutout
            ?player+' helps shut out '+opponent+'!'
            :pitch.tier==='great'
              ?player+' delivers a great outing on the mound!'
              :pitch.tier==='solid'
                ?player+' puts together a solid pitching performance!'
                :pitch.tier==='good'
                  ?player+' turns in a good pitching outing!'
                  :player+' keeps hitters under control!';
          add('pitching',pitch.tier,label,title,
            pitch.detail+' against '+opponent+'.');
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
            `${reached}-for-${pa} reaching base against ${opponent}: ${[hits>0?plural(hits,'hit'):null,walks>0?plural(walks,'walk'):null,hitByPitch>0?plural(hitByPitch,'hit by pitch','hit by pitches'):null].filter(Boolean).join(', ')}.`);
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
