import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const preseason=readFileSync(new URL('../src/PreseasonStats.jsx',import.meta.url),'utf8');
const regular=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const records=readFileSync(new URL('../src/preseason-game-data.js',import.meta.url),'utf8');

for(const key of ['heatingUpCount','longestHotStreak','Hot Games','Longest Hot Streak']){
  assert.equal(preseason.includes(key),false,'Preseason must not display '+key);
}
assert.equal(regular.includes("['heatingUpCount','Hot Games']"),true,'Official player stats keep Hot Games');
assert.equal(regular.includes("['longestHotStreak','Longest Hot Streak']"),true,'Official player stats keep Hot Streaks');
assert.equal(records.includes('gamePointsForReport'),true,'Preseason Game Point scoring remains intact');
console.log('Preseason Heating Up / Hot Games statistics hidden, regular-season counters preserved.');
