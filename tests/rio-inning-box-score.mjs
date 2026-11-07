import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractRioInningScores,validateInningScores} from '../src/rio-inning-scores.js';
import {earnedSixInningCompleteGame} from '../src/season-data.js';
import {validateRioMatchup} from '../src/rio-team-mapping.js';
import {seasonBoxScore,preseasonBoxScore,previewPrivateGameBoxScore} from '../src/game-box-score-data.js';

const away='New Donk City Fuggetaboudits',home='Delfino Dolphins';
const season={id:'season',teams:[{id:'away',slot:9,name:away},{id:'home',slot:1,name:home}]};
const game={id:'test',week:1,stage:'final',phase:'regular',away:'away',home:'home'};
const rows=Array.from({length:26},()=>[]);
rows[21][12]='Scorecard';
for(let i=0;i<7;i++)rows[22][10+i]=i+1;
rows[22][17]='Final';
rows[23][9]='DK Wilds';
[3,2,0,0,1,0,2].forEach((runs,i)=>rows[23][10+i]=runs);
rows[23][17]=8;
rows[24][9]='Jr. Rookies';
[1,3,0,5,2,2,0].forEach((runs,i)=>rows[24][10+i]=runs);
rows[24][17]=13;
const expected={away:[3,2,0,0,1,0,2],home:[1,3,0,5,2,2,0]};
assert.deepEqual(extractRioInningScores(rows,season.teams,game),expected,
  'Real Project Rio Scorecard layout must preserve every inning including repeated zeros');
assert.deepEqual(validateInningScores(expected,8,13),expected);
// A played zero is NOT equivalent to an unplayed bottom-of-seventh (X/blank).
const skippedRows=rows.map(row=>[...row]);
skippedRows[24][16]='X';
const skipped=extractRioInningScores(skippedRows,season.teams,game);
assert.equal(skipped.home[6],null,'X/blank bottom seventh stays an unplayed inning');
assert.equal(extractRioInningScores(rows,season.teams,game).home[6],0,
  'A recorded scoreless bottom seventh must remain a played zero');
// The first physical scorecard row may be the team that bats BOTTOM.
// Both explicit labels and team aliases are supported in either row order.
const bottomFirst=rows.map(row=>[...row]);
bottomFirst[23]=[...rows[24]];
bottomFirst[24]=[...rows[23]];
bottomFirst[23][9]='Jr. Rookies (Bottom)';
bottomFirst[24][9]='DK Wilds (Top)';
bottomFirst[23][16]='X';
assert.equal(validateRioMatchup(bottomFirst,season.teams,game).length,2,
  'Game Info matchup recognition ignores the optional batting-half tag');
const bottomFirstScore=extractRioInningScores(bottomFirst,season.teams,game);
assert.deepEqual(bottomFirstScore,{
  away:[3,2,0,0,1,0,2],
  home:[1,3,0,5,2,2,null],
  top:'away',
},'X in FIRST displayed scorecard row belongs to the coin-toss Bottom side');
assert.deepEqual(validateInningScores(bottomFirstScore,8,13),bottomFirstScore);
const awayPitcher={player:'Ronald',chosen:45,label:away,inningspitched:6,completegames:0};
const visitingSixInningPreview={labels:[away,home],pitch:[awayPitcher],inningScores:bottomFirstScore};
assert.equal(earnedSixInningCompleteGame(visitingSixInningPreview,awayPitcher),true,
  'CG goes to the visiting pitcher despite X being in the top spreadsheet row');
const playedZero=bottomFirst.map(row=>[...row]);
playedZero[23][16]=0;
const playedScore=extractRioInningScores(playedZero,season.teams,game);
assert.equal(playedScore.home[6],0);
assert.equal(earnedSixInningCompleteGame({...visitingSixInningPreview,inningScores:playedScore},awayPitcher),false,
  'Numerical 0 means scoreless played half, never automatic shortened CG');
// Coin toss can assign TOP to the SSL-scheduled HOME team, even though
// that team is in the second line of the scorecard.
const flipped=bottomFirst.map(row=>[...row]);
flipped[23][9]='Jr. Rookies (Top)';
flipped[24][9]='DK Wilds (Bottom)';
flipped[23][16]=0;
flipped[24][16]='X';
assert.deepEqual(extractRioInningScores(flipped,season.teams,game),{
  away:[3,2,0,0,1,0,null],
  home:[1,3,0,5,2,2,0],
  top:'home',
},'Coin toss can make the scheduled HOME team bat TOP and scheduled AWAY team bat BOTTOM');
const flippedPitcher={...awayPitcher,label:home};
assert.equal(earnedSixInningCompleteGame({
  labels:[away,home],pitch:[flippedPitcher],
  inningScores:extractRioInningScores(flipped,season.teams,game),
},flippedPitcher),true,
  'Six-inning CG belongs to top-batting scheduled HOME pitcher when bottom seventh is X');
const partial=bottomFirst.map(row=>[...row]);
partial[24][9]='DK Wilds';
assert.throws(()=>extractRioInningScores(partial,season.teams,game),
  /needs one \(Top\) and one \(Bottom\)/,
  'Partial (Top)/(Bottom) tagging is rejected to prevent miscrediting');
const bothTop=bottomFirst.map(row=>[...row]);
bothTop[24][9]='DK Wilds (Bottom)';
bothTop[23][9]='Jr. Rookies (Bottom)';
assert.throws(()=>extractRioInningScores(bothTop,season.teams,game),
  /needs one \(Top\) and one \(Bottom\)/,
  'Both team tags cannot say Bottom');
// Exact reported scorecard: Jr. Rookies scheduled AWAY but coin-toss BOTTOM,
// Bowser Monsters scheduled HOME but coin-toss TOP; X is in FIRST row.
const coinTeams=[{id:'rookies',slot:1,name:'Delfino Dolphins'},
  {id:'monsters',slot:11,name:'TWILIGHT TOWN TANKS'}];
const coinGame={away:'rookies',home:'monsters'};
const userScorecard=[
  ['Scorecard'],
  ['', '',1,2,3,4,5,6,7,'Final'],
  ['Jr. Rookies (Bottom)','',0,0,1,0,2,0,'x',3],
  ['Bowser Monsters (Top)','',1,0,3,0,0,0,0,4],
];
const coinResult=extractRioInningScores(userScorecard,coinTeams,coinGame);
assert.deepEqual(coinResult,{
  away:[0,0,1,0,2,0,null],
  home:[1,0,3,0,0,0,0],
  top:'home',
},'Real reversed, coin-toss-labeled 3–4 scorecard must import without an unreadable scorecard error');
assert.deepEqual(validateInningScores(coinResult,3,4),coinResult);
const coinPitcher={player:'Ronald',chosen:45,label:'TWILIGHT TOWN TANKS',inningspitched:6,completegames:0};
assert.equal(earnedSixInningCompleteGame({
  labels:['Delfino Dolphins','TWILIGHT TOWN TANKS'],
  pitch:[coinPitcher],inningScores:coinResult,
},coinPitcher),true,'Ronald completes every defensive inning even when his scheduled HOME team bats TOP');
assert.equal(earnedSixInningCompleteGame({
  labels:['Delfino Dolphins','TWILIGHT TOWN TANKS'],
  pitch:[{...coinPitcher,label:'Delfino Dolphins'}],inningScores:coinResult,
},{...coinPitcher,label:'Delfino Dolphins'}),false,
  'Do not credit pitcher from the BOTTOM-batting team');
// Vertical Rio scorecard layouts also use the team name/half rather than
// positional order of the team columns.
const vertical=[['Inning','Jr. Rookies (Bottom)','DK Wilds (Top)']];
for(let i=0;i<7;i++)vertical.push([i+1,[1,3,0,5,2,2,'X'][i],expected.away[i]]);
assert.deepEqual(extractRioInningScores(vertical,season.teams,game),bottomFirstScore,
  'Vertical scorecard can put Bottom team in first team column too');

assert.throws(()=>validateInningScores(expected,8,12),/do not match/);
const released=seasonBoxScore(season,{...game,result:{scores:{away:8,home:13},players:[],innings:expected}});
assert.deepEqual(released.innings,expected,'Official released box score carries inning lines');
const report={players:[{player:1,team:'away',stats:{runs:8,outs:0},gameScore:10,itemScore:0},
  {player:2,team:'home',stats:{runs:13,outs:0},gameScore:11,itemScore:0}],innings:expected};
const preview=previewPrivateGameBoxScore(season,game,report);
assert.deepEqual(preview.innings,expected,'Commissioner pre-upload preview shares inning data');
assert.equal(preview.teams[0].players[0].points.ogp,48,
  'Preview OGP is already calculated from the official offensive stats');
assert.equal(preview.teams[0].players[0].points.pgp,0,
  'Preview uses category Game Points independently for pitching');
const ps=preseasonBoxScore({
 gameId:'ps',round:1,away,home,awayScore:8,homeScore:13,fields:[],players:[],innings:expected
});
assert.deepEqual(ps.innings,expected,'Released preseason compact box score shows innings');

const source=fs.readFileSync('src/GameBoxScore.jsx','utf8');
assert.match(source,/<InningLineScore game=\{game\}\/>[\s\S]*<div className="ssl-box-scoreboard">/,
  'Inning scorecard belongs directly under box score heading, above totals and stats');
assert.match(source,/SCORING BY INNING/);
for(const [tab,points] of [['Batting','ogp'],['Fielding','dgp'],['Pitching','pgp']]){
  const start=source.indexOf("'"+tab+"':");
  const end=source.indexOf("'"+(tab==='Batting'?'Fielding':tab==='Fielding'?'Pitching':'Game Points')+"':",start+1);
  const block=start<0?'':end>start?source.slice(start,end):source.slice(start,source.indexOf('};',start));
  assert(block.includes("['"+points+"','"+points.toUpperCase()+"']"),
    tab+' tab must show its own '+points.toUpperCase()+' value in preview and official box scores');
}
assert.match(source,/\['tgp','ogp','dgp','pgp'\]\.includes\(key\)/,
  'Highlight each category Game Points total just like TGP');
assert.match(source,/player\.points\?\.\[key\]/,
  'Category columns must use the computed Game Points, not an old saved counter');
const importer=fs.readFileSync('src/season-data.js','utf8');
assert.match(importer,/if\(!inningScores\)throw Error/,'Do not silently save missing inning breakdowns');
const compact=fs.readFileSync('src/preseason-rio-report.js','utf8');
assert.match(compact,/mvp:Number\(mvp\),fields,players:compactPlayers,innings:raw.innings/,
  'Released preseason compact report must not drop inning lines');
console.log('PASS: 7-inning Project Rio Scorecard, saved preview and released box scores, missing data guard');
