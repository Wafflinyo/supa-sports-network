// Derived newsroom: no stored duplicate headlines when a report is corrected.
// Only released final games are visible; private recorded games remain embargoed.
export function leagueNews(seasons, players,{includeRecorded=false}={}) {
  const pool=new Map(players.map(p=>[Number(p.id),p.name]));
  const items=[];
  for(const season of seasons||[]) {
    const teamName=id=>season.teams?.find(t=>t.id===id)?.name||'the opposing team';
    for(const game of season.games||[]) {
      if(!(game.stage==='final'||(includeRecorded&&game.stage==='recorded'))||!Array.isArray(game.result?.players))continue;
      const at=game.releasedAt||game.result.postedAt||game.startsAt;
      for(const row of game.result.players) {
        const playerId=Number(row.player),player=pool.get(playerId)||'A player',stats=row.stats||{};
        const opponent=teamName(row.team===game.away?game.home:game.away);
        const score=Number(row.gameScore);
        const key=`game:${game.id}:${playerId}`;
        const add=(category,label,title,summary)=>items.push({
          id:`${key}:${category}`,category,label,title,summary,at,season:season.name,
          gameId:game.id,playerId,teamId:row.team,private:game.stage==='recorded',
        });
        if(row.gameScore!=null&&Number.isFinite(score)&&score>=90)
          add('heating','HEATING UP',`${player} is heating up!`,
            `A ${score} Game Score against ${opponent} earns ${player} a star for the next team game.`);
        const hr=Number(stats.homeRuns||0);
        if(hr>=1) add('home-run',hr>1?'MULTI-HR PERFORMANCE':'HOME RUN',
          hr>=3?`${player} crushes ${hr} home runs!`:
          hr===2?`${player} blasts two home runs!`:`${player} goes deep!`,
          `${hr} home run${hr===1?'':'s'} against ${opponent}.`);
        const runs=Number(stats.runs||0),rbi=Number(stats.rbi||0);
        if(runs+rbi>=5) add('offense','OFFENSIVE SPOTLIGHT',
          `${player} powers the offense!`,
          `${runs} run${runs===1?'':'s'} and ${rbi} RBI against ${opponent} — ${runs+rbi} combined.`);
        const defense=['putouts','assists','doublePlays','triplePlays']
          .reduce((n,k)=>n+Number(stats[k]||0),0);
        if(defense>=8) add('defense','DEFENSIVE SPOTLIGHT',
          `${player} puts on a defensive clinic!`,
          `${defense} combined putouts, assists, double plays and triple plays against ${opponent}.`);
        const strikeouts=Number(stats.pitchStrikeouts||0);
        if(strikeouts>=2) add('pitching','PITCHING SPOTLIGHT',
          `${player} racks up ${strikeouts} pitching strikeouts!`,
          `A strong outing against ${opponent}.`);
      }
    }
    for(const trade of season.transactions||[]) {
      const moves=trade.body?.moves||[];
      // Already-approved transactions only are included in season.transactions.
      if(!moves.length)continue;
      const playersMoved=moves.filter(m=>m.kind==='player');
      const first=playersMoved[0];
      const from=first?.from||moves[0]?.from,to=first?.to||moves[0]?.to;
      const headline=first&&from&&to
        ?`${teamName(from)} trades ${pool.get(Number(first.id))||'a player'} to ${teamName(to)}!`
        :`${teamName(from)} and ${teamName(to)} complete a trade!`;
      const detail=moves.map(m=>{
        const direction=`${teamName(m.from)} → ${teamName(m.to)}`;
        if(m.kind==='player')return `${pool.get(Number(m.id))||'Player'} (${direction})`;
        if(m.kind==='pick')return `Draft pick (${direction})`;
        return `Legacy asset (${direction})`;
      }).join(' · ');
      items.push({id:`trade:${trade.id}`,category:'trade',label:'TRADE APPROVED',
        title:headline,summary:detail,at:trade.createdAt||'',season:season.name,tradeId:trade.id});
    }
  }
  const validDate=t=>Number.isFinite(Date.parse(t||''))?Date.parse(t):0;
  return items.sort((a,b)=>validDate(b.at)-validDate(a.at)||a.id.localeCompare(b.id));
}
