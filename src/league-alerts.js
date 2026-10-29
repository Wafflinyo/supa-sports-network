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
const matchesTeam = (game, id) => String(game?.home) === String(id) || String(game?.away) === String(id);
const stamp = value => Number.isFinite(Date.parse(value || '')) ? Date.parse(value) : 0;
const nameList = names => names.length < 2 ? (names[0] || 'Player') : names.slice(0, 3).join(', ') + (names.length > 3 ? ' and others' : '');
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}) : 'Date TBD';

export function buildLeagueAlerts({season, myTeam, role, newsItems = [], now = Date.now(), inbox = [], players = []} = {}) {
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
    const offers=(inbox||[]).filter(o=>['pending','ready'].includes(o.status) && !(o.accepted||[]).includes(teamId));
    if (offers.length) alerts.push({
      id:id+':trades:'+offers.map(o=>o.id).sort().join(','),type:'task',
      title:offers.length===1?'Trade offer needs your response':offers.length+' trade offers need a response',
      detail:'Review pending trade offers in Messages.',target:{page:'Messages'},
    });
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
