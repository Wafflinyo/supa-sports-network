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

const ipString=outs=>Math.floor(outs/3)+'.'+(outs%3);
const pointsString=n=>Number.isInteger(n)?String(n):n.toFixed(2).replace(/0+$/,'').replace(/[.]$/,'');
const highlight=(label,value)=>({label,value:String(value)});
function performanceCategories(row){
 const s=row.stats, name=row.name;
 const hr=num(s.homeRuns),rbi=num(s.rbi),runs=num(s.runs),hits=num(s.hits),ab=num(s.atBats),
  doubles=num(s.doubles),triples=num(s.triples),steals=num(s.stolenBases),
  outs=num(s.outs),ks=num(s.pitchStrikeouts),er=num(s.earnedRuns),
  shutouts=num(s.shutouts),combined=num(s.combinedShutouts),complete=num(s.completeGames),
  putouts=num(s.putouts),assists=num(s.assists),buddy=num(s.buddyJumpPutouts),
  doublePlays=num(s.doublePlays),triplePlays=num(s.triplePlays),
  ogp=num(s.ogp),dgp=num(s.dgp),pgp=num(s.pgp);
 const avg=ab>0?hits/ab:0;
 const offensiveStrength=Math.max(
  hr>=2?100+hr*9:hr?65:0,
  rbi>=5?90+rbi*4:0,
  hits>=5?85+hits*4:0,
  ab>=4&&avg>=.7?90+hits*3:0,
  runs>=4?75+runs*4:0,
  steals>=2?80+steals*6:0,
  doubles>=3||triples>=2?75+2*(doubles+triples):0,
  ogp>=65&&hits+rbi+hr+runs>0?70+ogp/5:0
 );
 const defensiveTotal=putouts+assists+buddy+doublePlays+triplePlays;
 const defensiveStrength=defensiveTotal===0?0:Math.max(
  buddy>=2?100+buddy*9:0,
  triplePlays>=1?120+triplePlays*10:0,
  doublePlays>=2?95+doublePlays*8:0,
  defensiveTotal>=8?70+defensiveTotal*4:0,
  dgp>=20?70+dgp*1.6:0
 );
 const pitchingStrength=outs===0?0:Math.max(
  shutouts>=1?125+shutouts*15:0,
  combined>=1?115+combined*12:0,
  complete>=1?105+complete*12:0,
  ks>=4?90+ks*7:0,
  outs>=9&&er<=2?85+outs*2:0,
  pgp>=30?75+pgp*.65:0
 );
 const offenseFacts=[];
 if(hr)offenseFacts.push('hit '+hr+' '+plural(hr,'home run'));
 if(rbi)offenseFacts.push('drove in '+rbi+' '+plural(rbi,'run'));
 if(runs)offenseFacts.push('scored '+runs+' '+plural(runs,'run'));
 if(hits&&ab)offenseFacts.push('went '+batLine(hits,ab)+' at the plate');
 if(doubles>=2)offenseFacts.push('collected '+doubles+' doubles');
 if(triples)offenseFacts.push('recorded '+triples+' '+plural(triples,'triple'));
 if(steals)offenseFacts.push('stole '+steals+' '+plural(steals,'base'));
 const pitchingFacts=[];
 if(outs) pitchingFacts.push('worked '+ipString(outs)+' innings');
 if(ks) pitchingFacts.push('struck out '+ks+' '+plural(ks,'batter'));
 if(outs) pitchingFacts.push('allowed '+er+' earned '+plural(er,'run'));
 if(shutouts) pitchingFacts.push('earned '+shutouts+' solo '+plural(shutouts,'shutout'));
 if(combined) pitchingFacts.push('contributed to '+combined+' combined '+plural(combined,'shutout'));
 if(complete) pitchingFacts.push('finished '+complete+' complete '+plural(complete,'game'));
 if(pgp>=20) pitchingFacts.push('earned '+pointsString(pgp)+' PGP');
 const defenseFacts=[];
 if(putouts)defenseFacts.push(putouts+' '+plural(putouts,'putout'));
 if(assists)defenseFacts.push(assists+' '+plural(assists,'assist'));
 if(buddy)defenseFacts.push(buddy+' Buddy Jump '+plural(buddy,'putout'));
 if(doublePlays)defenseFacts.push(doublePlays+' '+plural(doublePlays,'double play'));
 if(triplePlays)defenseFacts.push(triplePlays+' '+plural(triplePlays,'triple play'));
 if(dgp>=20)defenseFacts.push(pointsString(dgp)+' DGP');
 const categories=[
  {key:'offense',strength:offensiveStrength,
   title:hr>=2?name+"'s "+hr+'-homer burst earns conference honors':
     rbi>=5?name+"'s "+rbi+'-RBI surge claims conference honors':
     hits>=5?name+"'s "+hits+' hits power conference award':
     name+"'s standout hitting earns conference honors",
   sentence:offenseFacts.length?'At the plate, '+name+' '+wordJoin(offenseFacts.slice(0,4))+'.':'',
   standouts:[hr&&highlight('HR',hr),rbi>=3&&highlight('RBI',rbi),
     hits&&ab&&highlight('H / AB',hits+' / '+ab),steals>=2&&highlight('SB',steals)].filter(Boolean)},
  {key:'pitching',strength:pitchingStrength,
   title:shutouts?name+"'s shutout pitching earns conference honor":
     combined?name+' shines in a combined shutout to claim conference honors':
     ks>=4?name+"'s "+ks+' strikeouts power conference award':
     complete?name+"'s complete-game effort wins conference honor":
     name+"'s dominant pitching earns conference recognition",
   sentence:pitchingFacts.length?'On the mound, '+name+' '+wordJoin(pitchingFacts)+'.':'',
   standouts:[outs&&highlight('IP',ipString(outs)),ks&&highlight('Pitch K',ks),
     outs&&highlight('ER',er),shutouts&&highlight('SHO',shutouts),
     pgp>=20&&highlight('PGP',pointsString(pgp))].filter(Boolean)},
  {key:'defense',strength:defensiveStrength,
   title:buddy>=2?name+"'s "+buddy+' Buddy Jump putouts headline defensive award':
     triplePlays?name+"'s triple-play heroics earn conference honors":
     doublePlays>=2?name+"'s "+doublePlays+' double plays earn conference honors":
     name+"'s spectacular glove work earns conference honors",
   sentence:defenseFacts.length?'In the field, '+name+' contributed '+wordJoin(defenseFacts)+'.':'',
   standouts:[putouts&&highlight('PO',putouts),assists&&highlight('AST',assists),
     buddy&&highlight('Buddy Jump',buddy),doublePlays&&highlight('DP',doublePlays),
     triplePlays&&highlight('TP',triplePlays),dgp>=20&&highlight('DGP',pointsString(dgp))].filter(Boolean)}
 ];
 // One or two home runs alone must not beat a genuinely exceptional pitcher or
 // fielder. Prefer the most notable supported two-game performance, not batting.
 return categories.filter(c=>c.strength>0&&c.sentence)
   .sort((a,b)=>b.strength-a.strength||
     ['pitching','defense','offense'].indexOf(a.key)-['pitching','defense','offense'].indexOf(b.key));
}
export function conferencePotwStory(season,award){
 const row=awardedTeamRow(season,award);
 if(!row)return {
  title:(potwPlayer(award.player)?.name||'SSL player')+' receives '+(award.awardTitle||'conference Player of the Week'),
  summary:'The commissioner selected '+(potwPlayer(award.player)?.name||'this player')+
    ' of '+award.teamName+' for '+potwWeekLabel(award.roundNo)+'.',
  detail:'This award recognizes the player’s two-game performance in '+potwWeekLabel(award.roundNo)+'.',
  standouts:[]
 };
 const players=twoGameAwardRows(season,award.roundNo).allPlayers;
 const played=potwTeamGames(season,award.roundNo,award.team);
 const team=record(season,played,String(award.team));
 const s=row.stats,hr=num(s.homeRuns),rbi=num(s.rbi),runs=num(s.runs);
 const teamName=award.teamName||row.teamName;
 const relevant=team.total===2?'the two-game stretch':'the award period';
 const recordText=team.total>0?team.wins+'–'+team.losses:'unrecorded';
 let opener;
 if(team.total===2 && team.wins===0)
   opener="Despite "+teamName+"'s 0–2 "+(Number(award.roundNo)===1?'start':'stretch')+
     ", "+row.name+" delivered an exceptional performance across its last two games.";
 else if(team.total===2 && team.wins===2)
   opener="As "+teamName+" "+(Number(award.roundNo)===1?'opened 2–0':'went 2–0')+
     " over its last two games, "+row.name+" played a leading role in the unbeaten run.";
 else if(team.total>0)
   opener="With "+teamName+" finishing "+recordText+" over "+relevant+
     ", "+row.name+" stood out for the club.";
 else opener=row.name+" put together a standout performance for "+teamName+".";
 const categories=performanceCategories(row);
 const categoryText=categories.map(category=>category.sentence);
 const leagueClaims=[];
 // A "league lead" can only use the same two-week award data for all players.
 for(const [key,label] of [
  ['homeRuns','home runs'],['pitchStrikeouts','pitching strikeouts'],
  ['putouts','putouts'],['buddyJumpPutouts','Buddy Jump putouts']
 ]){
  const n=num(s[key]);
  const threshold=key==='homeRuns'?2:key==='pitchStrikeouts'?4:key==='putouts'?8:2;
  if(n<threshold)continue;
  const lead=strongerLead(row,players,key);
  if(!lead)continue;
  leagueClaims.push(lead==='tied for the SSL lead'
   ?'With '+n+' '+label+', '+row.name+' tied for the SSL lead over this two-game award window.'
   :'With '+n+' '+label+', '+row.name+' led the entire SSL over this same two-game award window.');
 }
 const contribution=rbi>=2&&runs>=1&&team.scored>0?
   'Those '+rbi+' RBI and '+runs+' runs scored add up to '+
   (rbi+runs)+' combined RBI-plus-runs contributions; '+teamName+
   ' scored '+team.scored+' total '+plural(team.scored,'run')+' over its last two games.':null;
 const congratulation='Congratulations to '+row.name+' and the GM of '+teamName+'!';
 const details=[opener,...categoryText,...leagueClaims,
  ...(contribution?[contribution]:[]),congratulation];
 // Lead with the category that actually made the player exceptional. An elite
 // pitcher or defender never has to wait behind routine batting numbers.
 const title=categories[0]?.title||row.name+' earns conference honors for a standout two-game stretch';
 const summaryCategories=categories.filter((category,index)=>index===0||category.strength>=85);
 const summary=[opener,...summaryCategories.slice(0,2).map(category=>category.sentence),
  ...leagueClaims.slice(0,1),
  ...(contribution?[contribution]:[]),congratulation].join(' ');
 return {title,summary,detail:details.join(' '),
  standouts:categories.flatMap(c=>c.standouts.slice(0,3)).slice(0,5),
  featuredCategory:categories[0]?.key||'all-around',
  stats:{gamesPlayed:row.gamesPlayed,teamWins:team.wins,teamLosses:team.losses,
   teamRuns:team.scored,playerRuns:runs,rbi,homeRuns:hr,
   hits:num(s.hits),atBats:num(s.atBats),outs:num(s.outs),
   pitchingStrikeouts:num(s.pitchStrikeouts),earnedRuns:num(s.earnedRuns),
   putouts:num(s.putouts),assists:num(s.assists)}
 };
}
