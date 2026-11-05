import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leagueNews} from '../src/league-news.js';

const players=[{id:1,name:'Red Yoshi'},{id:2,name:'Blue Kritter'}];
const season={
  id:'capacity-season',name:'Season 1',teams:[{id:'a',name:'Team A'},{id:'b',name:'Team B'}],
  games:Array.from({length:20},(_,i)=>({
    id:'game-'+i,phase:'regular',week:1+Math.floor(i/6),
    stage:'recorded',away:'a',home:'b',
    result:{scores:{a:5,b:4},postedAt:new Date(Date.UTC(2026,10,4,19,i)).toISOString(),
      players:[
        {player:1,team:'a',gameScore:124,stats:{hits:2,homeRuns:1,oneHr:1,runs:1,rbi:2}},
        {player:2,team:'b',gameScore:35,stats:{hits:2,runs:1,rbi:1}},
      ]},
  })),
};
const commissioner=leagueNews([season],players,{includeRecorded:true});
const matches=commissioner.filter(item=>item.category==='match');
assert.equal(matches.length,20,'Every saved game creates a match recap, even after 8 or 10');
assert(matches.every(item=>item.private),'Recorded games remain commissioner-only');
assert(commissioner.length>20,'Player achievements can add news beyond match recaps');
assert.equal(leagueNews([season],players).length,0,'Private results must not leak publicly');

const dashboard=fs.readFileSync('src/HomeDashboard.jsx','utf8');
assert.match(dashboard,/const NEWS_PAGE_SIZE=8/);
assert.match(dashboard,/newsItems\.slice\(0,visibleNewsCount\)/);
assert.match(dashboard,/Math\.min\(count\+NEWS_PAGE_SIZE,newsItems\.length\)/);
assert.match(dashboard,/SHOWING \{displayedNewsCount\} OF \{newsItems\.length\}/);
assert.doesNotMatch(dashboard,/showAllNews\?newsItems:newsItems\.slice\(0,8\)/);
const styles=fs.readFileSync('src/styles.css','utf8');
const homeCSS=fs.readFileSync('src/home-dashboard.css','utf8');
assert.match(styles,/\.league-news-scroll\{max-height:none;overflow:visible/);
assert.match(homeCSS,/\.ssl-home-news \.league-news-scroll\{max-height:none;overflow:visible\}/);
console.log('PASS: no hard news cap, 20 private games generate previews, full counts and incremental loading without nested scrolling');
