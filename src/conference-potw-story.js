import {potwPlayer,potwTeamGames,potwWindowGames,potwWeekLabel} from './player-of-the-week.js';
import {aggregate} from './season-data.js';

// Read historical Project Rio rows directly. Current rosters can change after
// an award is issued; neither the recipient nor the original headline should
// disappear because of a later trade.
function twoGameAwardRows(season,roundNo){
 const selected=new Set((season?.teams||[]).flatMap(team=>
   potwTeamGames(season,roundNo,team.id).map(game=>String(game.id))));
 const allGames=potwWindowGames(season,roundNo)
   .filter(game=>selected.has(String(game.id)));
 const allStats=aggregate({...season,games:allGames});
 const allPlayers=Object.entries(allStats).map(([id,stats])=>({
   id:Number(id),stats,name:potwPlayer(id)?.name||'Player '+id,
   gamesPlayed:stats.gamesPlayed
 }));
 return {allPlayers,allGames};
}
function awardedTeamRow(season,award){
 const games=potwTeamGames(season,award.roundNo,award.team).map(game=>({
   ...game,result:{...game.result,players:(game.result?.players||[]).filter(p=>
     String(p.team)===String(award.team)&&Number(p.player)===Number(award.player))}
 }));
 const stats=aggregate({...season,games})[award.player];
 return stats?.gamesPlayed?{
   id:Number(award.player),name:potwPlayer(award.player)?.name||'Player '+award.player,
   stats,gamesPlayed:stats.gamesPlayed,team:award.team,
   teamName:award.teamName
 }:null;
}

const num=(value)=>Number(value)||0;
const safe=(number)=>Number.isFinite(number)?number:0;
const plural=(n,word)=>n===1?word:word+'s';
const wordJoin=values=>values.length<2?values[0]||'':
 values.length===2?values.join(' and '):
 values.slice(0,-1).join(', ')+', and '+values.at(-1);
const batLine=(hits,ab)=>ab>0?hits+'-for-'+ab+' ('+(hits/ab).toFixed(3)+')':null;
const record=(season,games,team)=>{
 let wins=0,losses=0,scored=0,allowed=0;
 for(const g of games){
   const isAway=String(g.away)===String(team);
   const other=isAway?g.home:g.away;
   const result=g.result?.scores||{};
   const mine=Number(result[team]),theirs=Number(result[other]);
   if(!Number.isFinite(mine)||!Number.isFinite(theirs))continue;
   scored+=mine;allowed+=theirs;
   if(mine>theirs)wins++;
   else if(mine<theirs)losses++;
 }
 return {wins,losses,scored,allowed,total:wins+losses};
};
function strongerLead(row,others,key){
 const value=num(row.stats[key]);
 if(value<=0)return null;
 const above=others.filter(p=>p.id!==row.id && num(p.stats[key])>value);
 const tied=others.filter(p=>p.id!==row.id && num(p.stats[key])===value);
 if(above.length)return null;
 return tied.length?'tied for the SSL lead':'leading the SSL outright';
}
function getHeadline(row,leaders){
 const s=row.stats,hr=num(s.homeRuns),rbi=num(s.rbi),h=num(s.hits),k=num(s.pitchStrikeouts),
       outs=num(s.outs),po=num(s.putouts),dgp=num(s.dgp);
 const leagueLead=strongerLead(row,leaders,'homeRuns');
 if(hr>=2)return row.name+"'s "+hr+'-homer explosion earns conference honors';
 if(hr===1&&leagueLead)return row.name+' hits into conference spotlight';
 if(rbi>=5)return row.name+"'s "+rbi+'-RBI surge claims conference honors';
 if(k>=4&&outs>=6)return row.name+"'s "+k+' strikeouts power conference award';
 if(outs>=9&&num(s.earnedRuns)<=2)return row.name+"'s dominant pitching wins conference honor";
 if(h>=5)return row.name+"'s "+h+' hits earn conference honors';
 if(po>=8||dgp>=20)return row.name+"'s fielding brilliance earns weekly award";
 return row.name+' earns conference honors for a standout two-game stretch';
}
export function conferencePotwStory(season,award){
 const row=awardedTeamRow(season,award);
 if(!row)return {
  title:(potwPlayer(award.player)?.name||'SSL player')+' receives '+(award.awardTitle||'conference Player of the Week'),
  summary:'The commissioner selected '+(potwPlayer(award.player)?.name||'this player')+
    ' of '+award.teamName+' for '+potwWeekLabel(award.roundNo)+'.',
  detail:'This award recognizes the player’s two-game performance in '+potwWeekLabel(award.roundNo)+'.'
 };
 const players=twoGameAwardRows(season,award.roundNo).allPlayers;
 const played=potwTeamGames(season,award.roundNo,award.team);
 const team=record(season,played,String(award.team));
 const s=row.stats,hr=num(s.homeRuns),rbi=num(s.rbi),runs=num(s.runs),
       hits=num(s.hits),atBats=num(s.atBats),outs=num(s.outs),
       strikeouts=num(s.pitchStrikeouts),earnedRuns=num(s.earnedRuns),
       putouts=num(s.putouts),assists=num(s.assists),
       steals=num(s.stolenBases), doubles=num(s.doubles), triples=num(s.triples),
       buddy=num(s.buddyJumpPutouts);
 const teamName=award.teamName||row.teamName;
 const relevant=team.total===2?'the two-game stretch':'the award period';
 const recordText=team.total>0?team.wins+'–'+team.losses:'unrecorded';
 let opener;
 if(team.total===2 && team.wins===0)
   opener="Despite "+teamName+"'s 0–2 stretch, "+row.name+
     " delivered an exceptional performance across its two most recent games.";
 else if(team.total===2 && team.wins===2)
   opener="As "+teamName+" went 2–0 over its last two games, "+row.name+
     " played a leading role in the unbeaten run.";
 else if(team.total>0)
   opener="With "+teamName+" finishing "+recordText+" over "+relevant+
     ", "+row.name+" stood out for the club.";
 else opener=row.name+" put together a standout performance for "+teamName+".";
 const highlights=[];
 const hrLead=strongerLead(row,players,'homeRuns');
 if(hr>0)highlights.push('crushed '+hr+' '+plural(hr,'home run'));
 if(rbi>0)highlights.push('drove in '+rbi+' '+plural(rbi,'run'));
 if(runs>0)highlights.push('scored '+runs+' '+plural(runs,'run'));
 if(hits>0&&atBats>0)highlights.push('went '+batLine(hits,atBats)+' at the plate');
 if(doubles>0)highlights.push('hit '+doubles+' '+plural(doubles,'double'));
 if(triples>0)highlights.push('added '+triples+' '+plural(triples,'triple'));
 if(steals>0)highlights.push('stole '+steals+' '+plural(steals,'base'));
 const pitching=[];
 if(outs>0){
   const innings=Math.floor(outs/3),part=outs%3;
   pitching.push('recorded '+innings+'.'+part+' innings pitched');
 }
 if(strikeouts>0)pitching.push('struck out '+strikeouts+' '+plural(strikeouts,'batter'));
 if(outs>0)pitching.push('allowed '+earnedRuns+' earned '+plural(earnedRuns,'run'));
 const defense=[];
 if(putouts>0)defense.push(putouts+' '+plural(putouts,'putout'));
 if(assists>0)defense.push(assists+' '+plural(assists,'assist'));
 if(buddy>0)defense.push(buddy+' buddy-jump '+plural(buddy,'putout'));
 const parts=[opener];
 if(highlights.length)parts.push(row.name+' '+wordJoin(highlights.slice(0,4))+'.');
 if(hrLead && hr>=2){
   parts.push(hrLead==='tied for the SSL lead'
     ?'Those '+hr+' home runs tied for the SSL lead over this same two-game award window.'
     :'Those '+hr+' home runs led the entire SSL over the same two-game award window.');
 }
 if(pitching.length && (outs>=6||strikeouts>=2||!highlights.length))
   parts.push('On the mound, '+row.name+' '+wordJoin(pitching)+'.');
 if(defense.length && (!highlights.length||num(s.dgp)>num(s.ogp)))
   parts.push('In the field, '+row.name+' contributed '+wordJoin(defense)+'.');
 // Runs plus RBI may count the same run twice, so never describe this
 // number as distinct runs directly "responsible for".
 if(rbi>=2&&runs>=1&&team.scored>0)
   parts.push('Those '+rbi+' RBI and '+runs+' runs scored add up to '+
     (rbi+runs)+' combined RBI-plus-runs contributions; '+teamName+
     ' scored '+team.scored+' total '+plural(team.scored,'run')+' over its last two games.');
 parts.push('Congratulations to '+row.name+' and the GM of '+teamName+'!');
 return {
   title:getHeadline(row,players),
   summary:parts.slice(0,2).join(' '),
   detail:parts.join(' '),
   stats:{gamesPlayed:row.gamesPlayed,teamWins:team.wins,teamLosses:team.losses,
     teamRuns:team.scored,playerRuns:runs,rbi,homeRuns:hr,hits,atBats,outs,
     pitchingStrikeouts:strikeouts,earnedRuns,putouts,assists},
 };
}
