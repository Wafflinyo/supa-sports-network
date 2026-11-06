import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupScheduleWeeks,firstExpandedWeek} from '../src/schedule-week-grouping.js';

const games=[
 {id:'a',phase:'regular',week:1,stage:'final'},
 {id:'b',phase:'regular',week:1,stage:'recorded'},
 {id:'c',phase:'regular',week:2,stage:'scheduled'},
 {id:'d',phase:'regular',week:2,stage:'scheduled'},
 {id:'e',phase:'regular',week:3,stage:'scheduled'},
 {id:'f',phase:'playoffs',week:null,stage:'scheduled'},
];
const groups=groupScheduleWeeks(games);
assert.deepEqual(groups.map(g=>g.key),['regular:1','regular:2','regular:3','playoffs:other']);
assert.deepEqual(groups.map(g=>g.games.map(game=>game.id)),[['a','b'],['c','d'],['e'],['f']]);
assert.deepEqual(groups.map(g=>g.label),['WEEK 1','WEEK 2','WEEK 3','POSTSEASON GAMES']);
assert.equal(firstExpandedWeek(groups),'regular:1','First week with unfinished games opens by default');
assert.equal(firstExpandedWeek(groups,g=>g.stage==='scheduled'),'regular:2',
 'GM game-lineup list defaults to first editable week');
assert.equal(firstExpandedWeek(groupScheduleWeeks(games.slice(0,1))),'regular:1',
 'When every game is final, first week remains accessible');
assert.equal(firstExpandedWeek([]),null);
assert.deepEqual(groupScheduleWeeks([{id:'x',week:5,phase:'regular',stage:'final'}])[0].games.map(g=>g.id),['x'],
 'Week containers preserve the original games and their IDs');

const league=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const weekUi=readFileSync(new URL('../src/ScheduleWeekGroups.jsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/season.css',import.meta.url),'utf8');

assert.match(league,/const weekGroups=groupScheduleWeeks\(games\)/,
 'Public/commissioner Schedule uses grouped weeks');
assert.match(league,/\{weekGroups\.map\(group=><ScheduleWeekGroup/,
 'Public/commissioner Schedule renders collapsible week sections');
assert.match(league,/const fixtureWeeks=groupScheduleWeeks\(fixtures\.filter/,
 'GM and commissioner roster lineup lists group weeks');
assert.match(league,/\{fixtureWeeks\.map\(group=><ScheduleWeekGroup/,
 'GM lineup sections can be minimized by week');
assert.equal((league.match(/<ScheduleWeekControls containerRef=/g)||[]).length,2,
 'Public/commissioner and GM lists both have expand/collapse all controls');
assert.match(league,/target\?\.closest\('details\.ssl-collapsible-week'\)/,
 'GM reminder expands the hidden week before scrolling to the game');
assert.match(main,/target\?\.closest\('details\.ssl-collapsible-week'\)/,
 'Public Schedule reminder expands the hidden week before scrolling to the game');
assert.match(weekUi,/<details className="ssl-collapsible-week"/);
assert.match(weekUi,/onToggle=\{event=>setOpen\(event\.currentTarget\.open\)\}/,
 'Week toggles remain in sync with expand/collapse all');
assert.match(weekUi,/querySelectorAll\('details\.ssl-collapsible-week'\)/);
assert.match(style,/\.ssl-collapsible-week>\.schedule-week-heading:focus-visible/,
 'Week headings preserve keyboard-accessible focus styling');

console.log('PASS: week grouping, collapse/expand controls, public/commissioner/GM views and notification focus');
