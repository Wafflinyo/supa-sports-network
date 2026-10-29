import {preseasonReady} from './preseason.js';
import {gameLineupIsEditable} from './roster-lineups.js';
import {validLineup} from './season-data.js';
import {heatingUpForSeason} from './heating-up.js';

// Alerts are derived from the public/current season and the signed-in GM's team.
// Do not write to draft state, reveal unreleased results, or use opponents'
// unplayed/scheduled lineup submissions.
const activePhases = new Set(['postdraft','regular','postseason','retention']);
const postseasonPhases = new Set(['postseason','retention','offseason','archived']);
const sevenDays = 7 * 24 * 60 * 60 * 1000;
const twoDays = 2 * 24 * 60 * 60 * 1000;
const matchesTeam = (game, id) => String(game?.home) === String(id) || String(game?.away) === String(id);
const stamp = value => Number.isFinite(Date.parse(value || '')) ? Date.parse(value) : 0;
const nameList = names => names.length < 2 ? (names[0] || 'Player') : names.slice(0, 3).join(', ') + (names.length > 3 ? ' and others' : '');
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}) : 'Date TBD';
const gameClock = value=>value?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)):'Date TBD';
const isValidDate=value=>Number.isFinite(Date.parse(value||''));

export function buildLeagueAlerts({season, myTeam, role, newsItems = [], now = Date.now(), inbox = [], players = [], scheduleChanges = []} = {}) {
  if (!season || !['gm','commissioner'].includes(role)) return [];
  const id = String(season.id);
  const alerts = [];
  const teamId = myTeam?.id;
  const teamName = value => season.teams?.find(t => String(t.id) === String(value))?.name || 'Opponent';
  const playerNames = new Map(players.map(p=>[Number(p.id),p.name]));
  const playerName = value => playerNames.get(Number(value)) || 'Player';
  if (teamId && activePhases.has(season.status)) {
    const roster = season.rosters?.[teamId] || [];
    if (roster.length < 11) alerts.push({
      id:id+':roster-short',type:'task',title:'Complete your roster',
      detail:'You need at least 11 players before setting your default lineup.',
      target:{page:'Free Agency'},
    });
    else if (season.needsDefault?.includes(teamId) || !validLineup(season,teamId,season.defaults?.[teamId])) alerts.push({
      id:id+':default-lineup:'+String(teamId),type:'task',
      title:'Set your default lineup',detail:'Choose your starting nine, batting order, pitcher and bench.',
      target:{page:role==='gm'?'GM Tools':'Commissioner Tools',section:'Roster',focus:'default'},
    });
  }
  if (preseasonReady(season)) alerts.push({
    id:id+':preseason-bracket',type:'announcement',
    title:'Pre-season bracket is ready',detail:'The 12 teams are seeded by their average draft pick time.',
    target:{page:'Playoff Bracket',section:'Pre-season'},
  });
  const regularGames=(season.games || []).filter(g=>g.phase==='regular');
  if (season.schedulePublished && regularGames.length) alerts.push({
    id:id+':schedule-published',type:'announcement',
    title:'Season schedule released',detail:'The league matchups are now available. Dates will update as they are assigned.',
    target:{page:'Schedule'},
  });
  if (postseasonPhases.has(season.status)) alerts.push({
    id:id+':playoff-bracket',type:'announcement',
    title:'Playoff bracket is available',detail:'Check the road to the SSL championship.',
    target:{page:'Playoff Bracket',section:'Playoffs'},
  });
  // Only official, already-released game results create notifications.
  // Neither 'recorded' nor any private pre-premiere result may be exposed.
  if (teamId) {
    const released=(season.games||[])
      .filter(g=>matchesTeam(g,teamId) && g.stage==='final' &&
        g.result?.scores && g.result.scores[g.away]!=null && g.result.scores[g.home]!=null)
      .sort((a,b)=>stamp(b.releasedAt||b.result?.postedAt||b.startsAt)-
        stamp(a.releasedAt||a.result?.postedAt||a.startsAt)).slice(0,8);
    for (const game of released) {
      const away=teamName(game.away),home=teamName(game.home);
      const awayScore=game.result.scores[game.away],homeScore=game.result.scores[game.home];
      const myScore=String(game.away)===String(teamId)?awayScore:homeScore;
      const theirScore=String(game.away)===String(teamId)?homeScore:awayScore;
      const result=Number(myScore)>Number(theirScore)?'WIN':Number(myScore)<Number(theirScore)?'LOSS':'FINAL';
      alerts.push({
        id:id+':game-result:'+String(game.id),type:'announcement',
        title:'Final result released · '+result,
        detail:away+' '+awayScore+' – '+homeScore+' '+home+' · View game results and statistics.',
        target:{page:'Schedule',focus:'game',gameId:game.id},
      });
    }
  }
  // Ballot objects are already personalized by the league's authorized read.
  for (const [kind,window] of Object.entries(season.ballotWindows||{})) {
    const closes=stamp(window?.closesAt);
    if(!window?.open||!closes||closes<=now)continue;
    const ballotName=window.label|| (kind==='allstar'?'All-Star Voting':'League Award Voting');
    const hasVoted=Array.isArray(window.myChoices)&&window.myChoices.length>0;
    alerts.push({
      id:id+':vote-open:'+kind+':'+window.closesAt,type:'announcement',
      title:ballotName+' is open',
      detail:hasVoted?'Your ballot is saved. View or update it before the deadline.':'Cast your ballot before '+gameClock(window.closesAt)+'.',
      target:{page:'Voting',focus:'ballot',ballot:kind},
    });
    if(!hasVoted&&closes-now<=twoDays)alerts.push({
      id:id+':vote-deadline:'+kind+':'+window.closesAt,type:'task',
      title:ballotName+' closes soon',
      detail:'Voting closes '+gameClock(window.closesAt)+'. Submit your choices before the deadline.',
      target:{page:'Voting',focus:'ballot',ballot:kind},
    });
  }
  // The local matchup snapshot creates one event only when a published game
  // changed since the GM last saw it. Do not treat a new schedule as a change.
  if(teamId)alerts.push(...scheduleChanges.filter(e=>e.id?.startsWith(id+':schedule-change:') && String(e.teamId)===String(teamId)));
  if (teamId && ['regular','postseason'].includes(season.status)) {
    const nextGames=(season.games || [])
      .filter(g=>matchesTeam(g,teamId) && g.stage==='scheduled' &&
        stamp(g.startsAt)>now && stamp(g.startsAt)<=now+sevenDays &&
        gameLineupIsEditable(season,teamId,g) &&
        !validLineup(season,teamId,g.lineups?.[teamId]))
      .sort((a,b)=>stamp(a.startsAt)-stamp(b.startsAt)).slice(0,3);
    for (const game of nextGames) {
      const opponent=teamName(String(game.home)===String(teamId)?game.away:game.home);
      alerts.push({
        id:id+':game-lineup:'+String(game.id),type:'task',gameId:game.id,
        title:'Submit lineup vs '+opponent,
        detail:'Scheduled '+dateLabel(game.startsAt)+' · '+(String(game.home)===String(teamId)?'Home':'Away')+' matchup.',
        canUseDefault:validLineup(season,teamId,season.defaults?.[teamId]),
        target:{page:role==='gm'?'GM Tools':'Commissioner Tools',section:'Roster',focus:'game',gameId:game.id},
      });
    }
  }
  if (teamId) {
    const last = (season.games || [])
      .filter(g=>g.stage==='final' && matchesTeam(g,teamId))
      .sort((a,b)=>stamp(b.releasedAt||b.result?.postedAt||b.startsAt)-stamp(a.releasedAt||a.result?.postedAt||a.startsAt))[0];
    if (last) {
      const heat = heatingUpForSeason(season).events.filter(e=>String(e.gameId)===String(last.id) && String(e.team)===String(teamId));
      if (heat.length) alerts.push({
        id:id+':heat:'+String(last.id),type:'announcement',title:heat.length===1?'Your player is Heating Up!':'Your players are Heating Up!',
        detail:nameList(heat.map(e=>playerName(e.playerId)))+' earned a heat star from the last game.',
        target:{page:role==='gm'?'GM Tools':'Commissioner Tools',section:'Roster',focus:'roster'},
      });
      const featured=new Map(newsItems
        .filter(n=>String(n.gameId)===String(last.id) && String(n.teamId)===String(teamId) && !!n.playerId && !n.private)
        .map(n=>[Number(n.playerId),n]));
      if (featured.size) alerts.push({
        id:id+':news:'+String(last.id),type:'announcement',title:'Your team made the news feed',
        detail:nameList([...featured.keys()].map(playerName))+' featured on the SSL home page.',
        target:{page:'Home',focus:'news'},
      });
    }
  }
  // The secure inbox only contains offers belonging to this GM (or all offers
  // for the commissioner). Status-based IDs are stable and re-notify on change.
  const offers=(inbox||[]).filter(o=>o?.id && o.body?.teams &&
    (role==='commissioner'||(teamId&&o.body.teams.some(t=>String(t)===String(teamId)))));
  if(teamId)for(const offer of offers.filter(o=>['pending','ready'].includes(o.status) &&
    !(o.accepted||[]).some(t=>String(t)===String(teamId))))alerts.push({
      id:id+':trade-action:'+offer.id,type:'task',
      title:'Trade offer needs your response',
      detail:'A trade offer is awaiting your decision.',
      target:{page:'Messages',focus:'trade',offerId:offer.id},
    });
  if(role==='commissioner')for(const offer of offers.filter(o=>o.status==='ready'))alerts.push({
    id:id+':trade-review:'+offer.id,type:'task',
    title:'Trade ready for commissioner approval',
    detail:'All teams have accepted. Review the offer before processing it.',
    target:{page:'Messages',focus:'trade',offerId:offer.id},
  });
  const terminal=new Set(['approved','rejected','countered','cancelled']);
  for(const offer of offers.slice(0,40)){
    const status=offer.status;
    const participants=(offer.body.teams||[]).map(teamName).join(' / ');
    if(terminal.has(status)){
      const text={
        approved:'approved and processed',rejected:'declined',
        countered:'countered with a new proposal',cancelled:'cancelled',
      }[status];
      alerts.push({
        id:id+':trade-update:'+offer.id+':'+status,type:'announcement',
        title:'Trade offer '+text,
        detail:participants+' · View the offer in Messages.',
        target:{page:'Messages',focus:'trade',offerId:offer.id},
      });
    }else if(status==='ready'&&role!=='commissioner'){
      alerts.push({
        id:id+':trade-update:'+offer.id+':accepted',type:'announcement',
        title:'Trade accepted by all teams',
        detail:participants+' · Awaiting commissioner approval.',
        target:{page:'Messages',focus:'trade',offerId:offer.id},
      });
    }
  }
  return alerts;
}

// The opponent's most recent *completed* game is the only permissible scouting
// source. Never fall back to their current default or pending next-game lineup.
export function opponentScouting(season,game,opponentId) {
  if (!season || !game) return null;
  if (!opponentId) return null;
  const previous=(season.games||[]).filter(g=>g.id!==game.id && g.stage==='final' &&
    matchesTeam(g,opponentId) && (!stamp(game.startsAt) || stamp(g.startsAt)<stamp(game.startsAt)))
    .sort((a,b)=>stamp(b.startsAt)-stamp(a.startsAt))[0];
  const lineup=previous?.lineups?.[opponentId] || previous?.result?.lineups?.[opponentId] || null;
  return {previous, lineup:lineup?.starters?.length===9 ? lineup : null};
}
