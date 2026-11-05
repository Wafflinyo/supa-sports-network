import assert from 'node:assert/strict';
import {matchHeadline} from '../src/game-headlines.js';

const teams=[
 {id:'w',name:'New Donk City Knights'},
 {id:'l',name:'Starborn Voidstriders'},
];
const players=[
 {id:1,name:'Wario'},{id:2,name:'Yoshi'},
 {id:3,name:'Bowser'},{id:4,name:'Luigi'},
];
const season={id:'s1',name:'Season 1',teams};
const row=(player,team,stats)=>({player,team,stats,gameScore:35});
const game={
 id:'two-team-recap',phase:'regular',week:1,stage:'final',
 away:'w',home:'l',
 result:{scores:{w:9,l:4},players:[
  row(1,'w',{hits:4}),
  row(2,'w',{putouts:8}),
  row(3,'l',{hits:4}),
  row(4,'l',{putouts:8}),
 ]},
};
const story=matchHeadline(season,game,players);
assert(story,'Released match should have a recap');
const text=story.summary;
const spots=[
 text.indexOf('New Donk City Knights:'),
 text.indexOf("These standout performances came in Week 1's win against the Starborn Voidstriders"),
 text.indexOf('Starborn Voidstriders:'),
 text.indexOf('Despite the Week 1 loss to the New Donk City Knights, these players left it all out on the diamond'),
];
assert(spots.every(n=>n>=0)&&spots.every((n,i)=>i===0||n>spots[i-1]),
 'Winning stats and winning outcome must precede losing stats and losing outcome');
assert(text.includes('Wario')&&text.includes('Yoshi')&&
 text.includes('Bowser')&&text.includes('Luigi'),
 'Keep all qualifying teammates on both sides of the final-score story');
assert(!text.includes('..'),'No extra punctuation between team sections');

// Batting highlights use verified hits/at-bats, and every achievement
// belonging to one player stays together before the next player starts.
const groupedGame={...game,id:'player-contiguous-highlights',
 result:{...game.result,players:[
  row(1,'w',{hits:4,atBats:4,buddyJumpPutouts:2}),
  row(2,'w',{putouts:8}),
  row(3,'l',{hits:4,atBats:5,assists:8}),
  row(4,'l',{hits:4}),
 ]},
};
const groupedStory=matchHeadline(season,groupedGame,players);
const groupedText=groupedStory.summary;
assert(groupedText.includes('Wario went 4-for-4 at the plate and made 2 Buddy Jump putouts'),
 'Pair a perfect four-hit game with the actual four at-bats and fielding recognition');
assert(groupedText.indexOf('Wario went 4-for-4')<
 groupedText.indexOf('2 Buddy Jump putouts')&&
 groupedText.indexOf('2 Buddy Jump putouts')<
 groupedText.indexOf('Yoshi recorded 8 defensive contributions'),
 'Keep the batting and fielding achievements of a player adjacent');
assert.equal((groupedText.match(/Wario /g)||[]).length,1,
 'One grouped recap mention per player, no name repetition');
assert(groupedText.includes('Bowser went 4-for-5 at the plate and recorded 8 defensive contributions'),
 'Never imply 4-for-4 when the official line was 4-for-5');
assert(groupedText.includes('Luigi racked up 4 hits'),
 'Without official at-bats, mention the hits but do not invent a denominator');
assert(!groupedText.includes('Luigi went 4-for-4'),
 'Missing at-bats must not become a perfect batting line');
assert(groupedText.indexOf('New Donk City Knights:')<
 groupedText.indexOf("Week 1's win against the Starborn Voidstriders")&&
 groupedText.indexOf("Week 1's win against the Starborn Voidstriders")<
 groupedText.indexOf('Starborn Voidstriders:'),
 'Group players without disturbing the separate winning and losing sections');
const privateGrouped=matchHeadline(season,{...groupedGame,stage:'recorded'},players,{includeRecorded:true});
assert.equal(privateGrouped.summary,groupedText,
 'Private previews also keep each player contiguous and use the correct at-bats');

// The walk-off outcome belongs in the winning team's recap, with no
// standalone "Confirmed walk-off finish" line after game highlights.
const walkoffGame={...game,id:'walkoff-recap',
  result:{...game.result,scores:{w:5,l:4}},
  story:{lateFinish:'walkoff'},
};
const walkoffStory=matchHeadline(season,walkoffGame,players);
assert.equal(walkoffStory.tier,'walkoff');
assert.match(walkoffStory.summary,
 /These standout performances came in Week 1's walk-off win against the Starborn Voidstriders/);
assert.doesNotMatch(walkoffStory.summary,/Confirmed walk-off finish/i);
assert(walkoffStory.summary.indexOf("Week 1's walk-off win") <
 walkoffStory.summary.indexOf('Starborn Voidstriders:'),
 'Walk-off context stays with winning players, ahead of losing-team highlights');
const privateWalkoff=matchHeadline(season,{...walkoffGame,stage:'recorded'},players,{includeRecorded:true});
assert.equal(privateWalkoff.summary,walkoffStory.summary,
 'Private walk-off previews use the same natural wording');

const privateStory=matchHeadline(season,{...game,stage:'recorded'},players,{includeRecorded:true});
assert(privateStory.private,'Commissioner preview stays private');
assert.equal(privateStory.summary,text,'Previews and public recaps use the same team-first order');
assert.equal(matchHeadline(season,{...game,stage:'recorded'},players),null,
 'Private game results never appear in public stories');

const winnerOnly=matchHeadline(season,{
 ...game,id:'winner-only',
 result:{...game.result,players:game.result.players.filter(r=>r.team==='w')},
},players);
assert(winnerOnly.summary.includes("Week 1's win against the Starborn Voidstriders"));
assert(!winnerOnly.summary.includes('Despite the Week 1 loss'),
 'Do not invent losing-player standouts when no losing players qualified');

const noHighlights=matchHeadline(season,{
 ...game,id:'no-highlights',result:{...game.result,players:[]},
},players);
assert(noHighlights.summary.includes('New Donk City Knights beat Starborn Voidstriders'),
 'Even games with no qualifying players keep a factual final-score summary');
console.log('PASS: ordered winner/loser stats and recaps, private preview parity, optional standouts');
