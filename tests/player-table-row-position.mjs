import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const playerData=readFileSync(new URL('../src/PlayerData.jsx',import.meta.url),'utf8');
const players=JSON.parse(readFileSync(new URL('../src/players.json',import.meta.url),'utf8'));

// The displayed # is the visible position after filtering AND sorting; the
// rosterOrder is retained only as a stable player identity/sort tiebreaker.
assert.match(main, /<tbody>\{filtered\.map\(\(p, rowIndex\) => <tr/);
assert.match(main, /<td className="roster-number">\{rowIndex \+ 1\}<\/td>/);
assert.doesNotMatch(main, /<td className="roster-number">\{p\.rosterOrder\}<\/td>/);
assert.match(main, /filtered = useMemo\(\(\) => players\.filter/);
assert.match(main, /\.sort\(\(a,b\) => \{/);

assert.match(playerData, /<tbody>\{filtered\.map\(\(p,rowIndex\)=>\{/);
assert.match(playerData, /key==='rosterOrder'\?rowIndex\+1:/);
assert.doesNotMatch(playerData, /key==='rosterOrder'\?p\.rosterOrder:/);
assert.match(playerData, /players\.filter\(p=>\{/);
assert.match(playerData, /\}\)\.sort\(\(a,b\)=>\{/);

function numberedRows(rows){
 return rows.map((player,index)=>({id:player.id,position:index+1}));
}

const original=players.slice(0,25);
const descending=[...original].sort((a,b)=>b.rosterOrder-a.rosterOrder);
const ascending=[...original].sort((a,b)=>a.rosterOrder-b.rosterOrder);
const filtered=descending.filter(p=>p.name.toLowerCase().includes('yoshi'));
for(const group of [original,descending,ascending,filtered]){
 assert.deepEqual(numberedRows(group).map(x=>x.position),Array.from({length:group.length},(_,i)=>i+1),
  'Positions must remain consecutive for any search, filter, or sort order');
}
assert.notEqual(numberedRows(descending)[0].id,numberedRows(ascending)[0].id,
 'Changing sort can reorder players while first visible position stays 1');
if(filtered.length){
 assert.equal(numberedRows(filtered)[0].position,1,
  'Searching must restart the visible ranking at 1');
}
console.log('PASS: Player Stats and Player Data show 1-based, contiguous positions after filtering or sorting');
