import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trophiesForTeam,trophyCabinetTeams} from '../src/trophy-cabinets.js';

const seasonTeams=Array.from({length:12},(_,i)=>({
 id:'team-'+(i+1),name:'Franchise '+String(i+1).padStart(2,'0'),
 conference:i<6?'supa':'galaxy'
}));
const cabinet=[
 {id:'w1:supa',team:'team-1',teamName:'Franchise 01',player:11,roundNo:1,seasonName:'Season 1'},
 {id:'w2:supa',team:'team-1',teamName:'Franchise 01',player:11,roundNo:2,seasonName:'Season 1'},
 {id:'w1:galaxy',team:'team-7',teamName:'Franchise 07',player:53,roundNo:1,seasonName:'Season 1'}
];
const overview=trophyCabinetTeams(seasonTeams,cabinet);
assert.equal(overview.length,12,'Every franchise appears even without an award');
assert.equal(overview.find(t=>t.id==='team-1').awards,2);
assert.equal(overview.find(t=>t.id==='team-7').awards,1);
assert.equal(overview.find(t=>t.id==='team-12').awards,0);
assert.equal(overview.reduce((sum,t)=>sum+t.awards,0),3);
assert.deepEqual(trophiesForTeam(cabinet,'team-1').map(a=>a.id),['w1:supa','w2:supa']);
assert.equal(trophiesForTeam(cabinet,'team-2').length,0);
assert.equal(trophiesForTeam(cabinet,undefined).length,0,
 'A signed-in GM without a linked team cannot see another franchise trophies');

// Permanently owned trophies remain accessible to the commissioner even if
// their former franchise is missing from this season's roster.
const archived={id:'old-season',team:'former-franchise',
 teamName:'Former Team',seasonName:'Season 0'};
const historic=trophyCabinetTeams(seasonTeams,[...cabinet,archived]);
assert.equal(historic.length,13);
assert.equal(historic.find(t=>t.id==='former-franchise').awards,1);
assert.equal(historic.find(t=>t.id==='former-franchise').current,false);
assert.equal(historic.find(t=>t.id==='team-12').awards,0);

const source=readFileSync(new URL('../src/PlayerOfTheWeek.jsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert.match(main,/'Trophy Cabinets'/);
assert.match(main,/commissionerTab==='Trophy Cabinets'\?<PotwTrophyCabinet/);
assert.match(main,/gmToolsTab==='Trophy Cabinet'\?<PotwTrophyCabinet/,
 'The GM's existing franchise-specific trophy cabinet remains available');
assert.match(source,/l\.access\?\.role==='commissioner'/);
assert.match(source,/const chosenTeam=commissioner[\s\S]+?:mine;/,
 'Only commissioner may select a franchise; GM is restricted to l.myTeam');
assert.match(source,/const awards=trophiesForTeam\(cabinet,chosenTeam\?\.id\)/);
console.log('PASS: 12 selectable commissioner cabinets, accurate counts, permanent archive awards, unchanged GM scoping.');
