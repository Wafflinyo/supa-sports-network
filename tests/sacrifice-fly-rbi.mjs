import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportRowStats,previewCustomGameScore,buildReport} from '../src/season-data.js';
import {gamePointsForReport} from '../src/game-points.js';
import {preseasonGames,preseasonPlayerStatsForGame} from '../src/preseason-game-data.js';

const sample={player:'Yellow Toad',chosen:31,position:'CF',label:'Away',
  atbats:0,plateappearances:1,sacflys:1,rbi:0,itemscore:0};
const stats=reportRowStats(sample);
assert.equal(stats.sacFlys,1);
assert.equal(stats.rbi,1,'Project Rio with 0 RBI + 1 sac fly must save 1 official RBI');
assert.equal(stats.atBats,0,'Sac fly cannot become a hitless official at-bat');
const preview={labels:['Away','Home'],rows:[sample],pitch:[]};
assert.equal(previewCustomGameScore(preview,sample).gameScore,8);
const report=buildReport(preview,'Away',{rosters:{a:[31],b:[32]}},
  {away:'a',home:'b'},[],null);
assert.equal(report.players[0].stats.rbi,1);
assert.equal(report.players[0].stats.sacFlys,1);
assert.equal(report.players[0].gameScore,8);
assert.equal(gamePointsForReport(report.players[0]).ogp,8);
assert.equal(gamePointsForReport(report.players[0]).tgp,8);

const originalRbis={...sample,rbi:2};
const combined=reportRowStats(originalRbis);
assert.equal(combined.rbi,3,'Previously recorded RBI credits remain plus 1 sac fly');
assert.equal(previewCustomGameScore({...preview,rows:[originalRbis]},originalRbis).gameScore,24);
assert.equal(reportRowStats({...sample,sacflys:0,rbi:2}).rbi,2,
  'A batter without a sac fly does not get a duplicate RBI');

// The six Round 1 preseason historical fixtures are source-of-truth, not a
// copy of the later preseason Supabase match reports.
const affected=[];
for(const game of preseasonGames){
  const sfIndex=game.fields.indexOf('sacFlys');
  const rbiIndex=game.fields.indexOf('rbi');
  assert(sfIndex>=0&&rbiIndex>=0);
  for(const [id,, ,values] of game.players){
    const sf=Number(values[String(sfIndex)]||0);
    if(sf>0){
      const rbi=Number(values[String(rbiIndex)]||0);
      assert(rbi>=sf,'A Round 1 sac fly must receive an official RBI');
      affected.push({game:game.gameId,id,sf,rbi});
    }
  }
}
assert.equal(affected.length,5);
assert.equal(affected.reduce((n,x)=>n+x.sf,0),5);
const haliban=preseasonGames.find(g=>g.gameId==='PSR1 Haliban @ Petilils');
const kritter=preseasonPlayerStatsForGame(haliban).find(x=>x.playerId===59);
assert.equal(kritter.stats.rbi,2,'Kritter RBI reflects sacrifice-fly credit');
assert.equal(kritter.stats.tgp,121,'Kritter Round 1 TGP becomes 121');

const migration=readFileSync(
  new URL('../supabase/migrations/20261107085000_ssl_credit_sacrifice_fly_rbis.sql',import.meta.url),'utf8');
assert.match(migration,/ssl_season_states/);
assert.match(migration,/ssl_preseason_game_reports/);
assert.match(migration,/new_compact_players/);
assert.match(migration,/current_rbi\+sf/);
assert.match(migration,/8\*sf/);
console.log('PASS: sacrifice flies credit one additional RBI and +8 OGP in imports, Round 1 history and stored full/compact reports');
