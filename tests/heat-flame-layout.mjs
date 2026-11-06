import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const portrait=readFileSync(new URL('../src/PlayerPortrait.jsx',import.meta.url),'utf8');
const badge=readFileSync(new URL('../src/HeatingUpBadge.jsx',import.meta.url),'utf8');
const data=readFileSync(new URL('../src/PlayerData.jsx',import.meta.url),'utf8');
const season=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');

function declaration(selector){
 const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=css.match(new RegExp(escaped+'\\{([^}]+)\\}'));
 assert(match,'Missing flame rule: '+selector);
 return match[1];
}
function pixels(rule,key){
 const match=rule.match(new RegExp('(?:^|;)\\s*'+key+':(-?\\d+)px(?:;|$)'));
 assert(match,'Missing '+key+' pixel value in: '+rule);
 return Number(match[1]);
}
const flame=declaration('.heat-mark');
const top=pixels(flame,'top'),right=pixels(flame,'right');
const width=pixels(flame,'width'),height=pixels(flame,'height');
assert(top<0&&top>=-8,'Flame stays above the portrait but within table row padding');
assert(right>=0,'Flame must be inset from the right edge toward the portrait, not the player name');
assert(width<=20&&height<=24,'Flame should be smaller than the former 25 x 28 badge');
for(const size of [29,31,32,38,68,76]){
 const flameRight=size-right;
 const flameLeft=flameRight-width;
 assert(flameLeft>=0&&flameRight<=size,
  'Flame stays inside horizontal portrait bounds at '+size+'px');
 assert(flameRight<size+10,
  'Flame cannot intrude on the text following a portrait');
}
assert.match(flame,/pointer-events:none/,'Badge must not intercept player card/link taps');
const inline=declaration('.heat-mark-inline');
assert.match(inline,/position:relative/,'Inline flames should stay in flow, after the player name');
assert(pixels(inline,'width')<width,'Inline flames also use the smaller design');
assert.match(portrait,/<HeatMark playerId=\{player.id\}\/>/,
 'All standard player portraits use the shared flame placement');
assert.match(badge,/heat-mark-inline/,
 'Inline badges share the corrected reduced dimensions');
assert.match(data,/<PlayerPortrait player=\{p\}/,
 'Player Data and stat tables use the shared portrait');
assert.match(season,/<PlayerPortrait player=\{p\}/,
 'Season team and roster views use the same portrait');
console.log('PASS: smaller, upper-left-shifted Heating Up flames remain clear of player names across standard portrait sizes');
