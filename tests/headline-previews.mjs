import assert from 'node:assert/strict';
import {leagueNews} from '../src/league-news.js';
import {matchHeadline,homepageHeadlineSlides} from '../src/game-headlines.js';
import {HEATING_UP_THRESHOLD} from '../src/heating-up.js';
const players=[{id:1,name:'Blue Kritter'},{id:2,name:'Red Yoshi'},{id:3,name:'King K. Rool'},{id:4,name:'Kritter'}];
const makeSeason=(stage='recorded',awayScore=6,homeScore=5)=>({
 id:'test',name:'Season 1',teams:[{id:'away',name:'New Donk City'},{id:'home',name:'Moleville Haliban'}],
 games:[{
  id:'game1',phase:'regular',week:1,stage,away:'away',home:'home',
  result:{scores:{away:awayScore,home:homeScore},players:[
   {player:1,team:'away',gameScore:HEATING_UP_THRESHOLD,stats:{runs:2,rbi:3,homeRuns:1,twoHr:1,putouts:3,assists:3,doublePlays:2}},
   {player:2,team:'away',gameScore:97,stats:{putouts:7,assists:5,doublePlays:5}},
   {player:3,team:'away',gameScore:88,stats:{putouts:6,doublePlays:5}},
   {player:4,team:'home',gameScore:114,stats:{homeRuns:1,oneHr:1}},
  ]}
 }],
 transactions:[],
});
const s=makeSeason();
assert.equal(matchHeadline(s,s.games[0],players),null,'Recorded result must not show publicly');
const preview=matchHeadline(s,s.games[0],players,{includeRecorded:true});
assert(preview?.private,'Recorded result has a private headline preview');
assert.equal(preview.teamSpotlight,'both','Close matchup highlights both teams');
assert.equal(preview.topPlayers.length,3);
assert.deepEqual(preview.topPlayers.map(p=>p.playerId),[1,4,2],
  'Top three ranked by actual Total Game Points, including opponent');
assert.equal(preview.topPlayers[0].gamePoints,HEATING_UP_THRESHOLD);
assert(preview.topPlayers[0].heatingUp,'Heating Up flame appears at official threshold');
assert(!preview.topPlayers[1].heatingUp,'Player below threshold has no flame');
const commissionerNews=leagueNews([s],players,{includeRecorded:true});
assert(commissionerNews.some(x=>x.category==='match'&&x.private));
assert(!leagueNews([s],players).some(x=>x.category==='match'),
  'Private story never enters public news');
assert.equal(homepageHeadlineSlides(null,commissionerNews,s.id,5,s).length,0,
  'Private headline excluded from public carousel');
const slides=homepageHeadlineSlides(null,commissionerNews,s.id,5,s,true);
assert(slides.length===1&&slides[0].story.private,'Commissioner sees private slide');
const dominant=makeSeason('recorded',13,2);
const dominantPreview=matchHeadline(dominant,dominant.games[0],players,{includeRecorded:true});
assert.equal(dominantPreview.teamSpotlight,'winner','Dominant display spotlights one crest');
assert(dominantPreview.topPlayers.every(p=>p.teamId==='away'),
  'Dominant team feature ranks only its players');
assert.equal(dominantPreview.topPlayers.length,3);
const finalSeason=makeSeason('final');
const publicStory=matchHeadline(finalSeason,finalSeason.games[0],players);
assert(publicStory&&!publicStory.private);
assert(homepageHeadlineSlides(null,leagueNews([finalSeason],players),finalSeason.id,5,finalSeason)
  .some(item=>item.story===undefined?false:!item.story.private),'Public final becomes public slide');
console.log('PASS: commissioner-only headline previews, correct logo strategy, top three TGP, fire threshold');
