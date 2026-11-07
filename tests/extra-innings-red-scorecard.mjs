import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {loadRioSheets} from '../src/rio-spreadsheet.js';
import {isRioRedColor,excelRioCellIsRed,rioOdsStyleIsRed} from '../src/rio-red-color.js';
import {extractRioInningScores,validateInningScores,inningScoringDrama} from '../src/rio-inning-scores.js';
import {matchHeadline,gameOutcomeContext} from '../src/game-headlines.js';
import {leagueNews} from '../src/league-news.js';

// The actual ODS style hierarchy can live in styles.xml or content.xml,
// and a named child can inherit a red font from its parent.
const styles=new Map([
  ['red',{color:'#D32F2F',parent:null,background:null}],
  ['inherited',{color:null,background:null,parent:'red'}],
  ['neutral',{color:'#1A2F52',background:null,parent:'red'}],
  ['redBackground',{color:null,background:'#FF3344',parent:null}],
]);
assert.equal(rioOdsStyleIsRed('inherited',styles),true);
assert.equal(rioOdsStyleIsRed('neutral',styles),false);
assert.equal(rioOdsStyleIsRed('redBackground',styles),true);
assert(isRioRedColor('#FF0000'));
assert(isRioRedColor('FFC00000'));
assert(isRioRedColor({argb:'FFD32F2F'}));
assert(!isRioRedColor('#17365B'));
assert(!isRioRedColor({argb:'FF169B53'}));
assert(excelRioCellIsRed({font:{color:{argb:'FFFF0000'}}}));
assert(excelRioCellIsRed({value:{richText:[{text:'8',font:{color:{argb:'FFCE2020'}}}]}}}));
assert(!excelRioCellIsRed({font:{color:{argb:'FF111111'}}}));

const teams=[
  {id:'rookies',slot:1,name:'Delfino Dolphins'},
  {id:'monsters',slot:11,name:'TWILIGHT TOWN TANKS'},
];
const game={id:'eight',stage:'final',phase:'regular',week:1,away:'rookies',home:'monsters'};
async function scorebook({count=8,redHeader=null,redScore=null,redFill=null}={}){
  const book=new ExcelJS.Workbook();
  book.addWorksheet('Stats').addRow(['mock']);
  book.addWorksheet('Pitching').addRow(['mock']);
  const info=book.addWorksheet('Game Info');
  info.addRow(['Scorecard']);
  info.addRow([null,null,...Array.from({length:count},(_,i)=>i+1),'Final']);
  info.addRow(['Jr. Rookies (Bottom)',null,...Array.from({length:count},(_,i)=>i===2?1:i===count-1?2:0),3]);
  info.addRow(['Bowser Monsters (Top)',null,...Array.from({length:count},(_,i)=>i===0?1:i===count-1?4:0),5]);
  if(redHeader)info.getRow(2).getCell(redHeader+2).font={color:{argb:'FFFF0000'}};
  if(redScore)info.getRow(4).getCell(redScore+2).font={color:{argb:'FFD02020'}};
  if(redFill)info.getRow(3).getCell(redFill+2).fill={
    type:'pattern',pattern:'solid',fgColor:{argb:'FFBC2020'},
  };
  const buffer=await book.xlsx.writeBuffer();
  const file={name:'scorecard.xlsx',size:buffer.length,
    arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)};
  const sheets=await loadRioSheets(file);
  return extractRioInningScores(sheets['Game Info'],teams,game);
}
const marked=await scorebook({count:8,redHeader:8});
assert.deepEqual(marked,{
  away:[0,0,1,0,0,0,0,2],
  home:[1,0,0,0,0,0,0,4],
  top:'home',extraInnings:true,redInnings:[8],
},'A red inning 8 in XLSX survives import, regardless of the rows/coin toss');
assert.deepEqual(validateInningScores(marked,3,5),marked);
const drama=inningScoringDrama(marked);
assert.equal(drama.extraInnings,true);
assert.equal(drama.extraInningCount,1);
assert.equal(drama.inningCount,8);
assert.deepEqual(drama.redInnings,[8]);
assert.deepEqual((await scorebook({count:8,redScore:8})).redInnings,[8],
  'A red run cell also signals extra innings');
assert.deepEqual((await scorebook({count:8,redFill:8})).redInnings,[8],
  'A red fill on an inning score is recognized');
const unmarked=await scorebook({count:8});
assert.equal(unmarked.extraInnings,true,'Eight inning scores prove extras without any red styles');
assert.equal(unmarked.redInnings,undefined);
const markedSeventh=await scorebook({count:7,redHeader:7});
assert.equal(markedSeventh.extraInnings,true,'Project Rio red marks take priority even on inning 7');
assert.deepEqual(markedSeventh.redInnings,[7]);
const standard=await scorebook({count:7});
assert.equal(standard.extraInnings,undefined,'Plain seven-inning baseball is not extra innings');

const season={id:'season-1',name:'Season 1',teams,games:[],transactions:[]};
const match={...game,result:{scores:{rookies:3,monsters:5},players:[],innings:marked}};
season.games=[match];
const headline=matchHeadline(season,match);
assert.equal(headline.extraInnings,true);
assert.equal(headline.inningCount,8);
assert.match(headline.label,/EXTRA-INNINGS/);
assert.match(headline.title,/8-inning/);
assert.match(headline.summary,/eight|8 innings|extra innings/i);
assert.equal(leagueNews([season],[]).filter(x=>x.category==='match')[0].extraInnings,true,
  'The news feed uses the same verified extra-inning match recap');
assert.match(gameOutcomeContext(season,match,'rookies'),/after 8 innings/);
const privateGame={...match,stage:'recorded'};
assert(!matchHeadline(season,privateGame));
assert(matchHeadline(season,privateGame,[],{includeRecorded:true}).private);
assert(!leagueNews([{...season,games:[privateGame]},[]],[]).some(x=>x.category==='match'),
  'Pre-release news remains private');

const box=readFileSync(new URL('../src/GameBoxScore.jsx',import.meta.url),'utf8');
assert.match(box,/EXTRA INNINGS/);
assert.match(box,/ssl-box-inning-extra/);
const ods=readFileSync(new URL('../src/rio-spreadsheet.js',import.meta.url),'utf8');
assert.match(ods,/styleEntry=zip\.file\('styles\.xml'\)/,
  'ODS named style XML is consulted for red inning cells');
assert.match(ods,/odsCellIsRed\(cell,styles\)/);
console.log('PASS: ODS style parsing, XLSX red/normal innings, persistent extra-innings flags, news, headlines and box-score badges');
