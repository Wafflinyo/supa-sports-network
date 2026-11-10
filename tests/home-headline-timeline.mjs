import assert from 'node:assert/strict';
import {conferenceAwardSlides,rollingHomepageHeadlines} from '../src/home-headline-timeline.js';
import {homepageHeadlineSlides} from '../src/game-headlines.js';

const seasonId='season-1';
const awards=[
 {seasonId,roundNo:1,conference:'supa',player:11,awardedAt:'2026-11-10T14:10:00Z'},
 {seasonId,roundNo:1,conference:'galaxy',player:53,awardedAt:'2026-11-10T14:10:00Z'},
];
const match=(id,week,at,importance=80)=>({id,kind:'match',
 story:{id,gameId:id,week,at,importance,seasonId}});
const period=conferenceAwardSlides(awards,seasonId);
assert.equal(period.length,1,'Both conference winners occupy one headline slot');
assert.equal(period[0].week,2);
assert.equal(period[0].kind,'potw');
assert.equal(period[0].awards.length,2);
assert.equal(conferenceAwardSlides(awards.slice(0,1),seasonId).length,0,
 'A single issued conference winner cannot create an incomplete banner');
assert.equal(conferenceAwardSlides(awards,'different-season').length,0,
 'Awards from past seasons cannot occupy the new season carousel');

const week2=Array.from({length:5},(_,i)=>
 match('week2-'+i,2,'2026-11-09T1'+i+':00:00Z'));
let slides=rollingHomepageHeadlines(week2,awards,seasonId);
assert.equal(slides.length,5);
assert.equal(slides[0].kind,'potw',
 'Newly issued award leads until a newer week releases results');

const expected=['potw','match','match','match','match','match'];
for(let i=1;i<=5;i++){
 const week3=Array.from({length:i},(_,index)=>match('week3-'+index,3,
  '2026-11-11T0'+index+':00:00Z'));
 slides=rollingHomepageHeadlines([...week3,...week2],awards,seasonId);
 assert.equal(slides.length,5);
 assert.deepEqual(slides.slice(0,Math.min(i,5)).map(x=>x.kind),
  expected.slice(1,i+1),'New Week 3 games should move award backward');
 if(i<5)assert.equal(slides[i].kind,'potw',
  'The award should move to slot '+(i+1)+' when '+i+' games post');
 else assert(!slides.some(x=>x.kind==='potw'),
  'After five Week 3 game stories, Week 1/2 award leaves the five-slot carousel');
}

const newerAwards=[...awards,
 {seasonId,roundNo:2,conference:'supa',awardedAt:'2026-11-20T14:00:00Z'},
 {seasonId,roundNo:2,conference:'galaxy',awardedAt:'2026-11-20T14:00:00Z'}];
slides=rollingHomepageHeadlines(
 Array.from({length:4},(_,i)=>match('week4-'+i,4,'2026-11-19T10:00:00Z')),
 newerAwards,seasonId);
assert.equal(slides[0].kind,'potw');
assert.equal(slides[0].roundNo,2,
 'The newly announced Weeks 3/4 awards take the #1 headline slot');
assert(!slides.some(x=>x.kind==='potw'&&x.roundNo===1),
 'Older awards must not be retained in the homepage just because they remain archived');

const afterNewerGame=rollingHomepageHeadlines(
 [match('late-week4',4,'2026-11-21T10:00:00Z')],
 newerAwards,seasonId);
assert.equal(afterNewerGame[0].id,'late-week4',
 'A genuinely newer story from the same week can move an award back');

const playoff=[match('playoff',null,'2026-11-23T10:00:00Z'),
 match('regular',2,'2026-11-10T10:00:00Z')];
slides=rollingHomepageHeadlines(playoff,newerAwards,seasonId);
assert.equal(slides[0].id,'playoff','Postseason headline outranks regular-season award');

const champion={id:'champ',kind:'champion'};
const championSlides=rollingHomepageHeadlines([match('week1',1,'2026-11-05'),champion],[],seasonId);
assert.deepEqual(championSlides.map(x=>x.id),['week1','champ'],
 'Preseason champion retains its normal fallback position before Week 2');

// Ensure the full production match selection pipeline still creates a public
// story for each verified final and only the rolling step adjusts its position.
const season={
 id:seasonId,games:Array.from({length:6},(_,i)=>({
 id:'week3-final-'+i,phase:'regular',week:3,stage:'final'
 }))
};
const news=season.games.map((game,i)=>({category:'match',private:false,gameId:game.id,
 id:'match:'+game.id,seasonId,week:3,at:'2026-11-12T12:00:00Z',
 importance:80-i}));
const official=homepageHeadlineSlides(null,news,seasonId,5,season);
assert.equal(official.length,5);
assert.equal(rollingHomepageHeadlines(official,awards,seasonId).filter(s=>s.kind==='potw').length,0);

console.log('PASS: award headliner moves from #1 to #5, rolls off after five newer game stories, newer pairs rotate in, archive stays separate.');
