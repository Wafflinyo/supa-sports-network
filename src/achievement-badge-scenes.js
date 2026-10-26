// Badge imagery is curated against the ACTUAL 92-item achievement catalog.
// Columns: real achievement ID | illustrated main subject | supporting subject |
// composition | meaningful engraving. Do not add awards from concept art.
const DRAWINGS = `
winning-opener|pennant|ball|sunburst|W
winning-1|trophy|spark|wreath|1
winning-5|star|trophy|split|5
winning-10|trophy|crown|rays|10
winning-15|crown|stars|laurel|15
winning-20|trophy|laurel|wings|20
winning-perfect|crown|diamond|royal|22–0
season-homer-1|bat|ball|diagonal|1
season-homer-5|ball|fire|rays|5
season-homer-10|crossed-bats|ball|split|10
season-homer-15|bat|star|laurel|15
season-homer-20|stadium|fire|sunburst|20
season-homer-25|crown|crossed-bats|royal|25
game-homer-1|ball|bat|diagonal|1
game-homer-3|crossed-bats|star|wreath|3
game-homer-5|fire|ball|rays|5
game-homer-7|ball|bolt|sunburst|7
game-homer-10|crossed-bats|crown|royal|10
game-runs-1|home-plate|spark|split|1
game-runs-5|runner|home-plate|diagonal|5
game-runs-10|scoreboard|ball|rays|10
game-runs-15|runner|fire|sunburst|15
game-runs-20|scoreboard|bolt|wreath|20
game-runs-25|stadium|stars|laurel|25
game-runs-30|crown|scoreboard|royal|30
game-rbi-1|bat|home-plate|diagonal|1
game-rbi-5|diamond|ball|split|5
game-rbi-10|bat|diamond|rays|10
game-rbi-15|scoreboard|crossed-bats|sunburst|15
game-rbi-20|diamond|fire|wreath|20
game-rbi-25|crossed-bats|stars|laurel|25
game-rbi-30|crown|diamond|royal|30
player-putouts-5|glove|ball|diagonal|5
player-putouts-8|glove|star|sunburst|8
player-putouts-10|glove|shield|split|10
player-putouts-12|glove|target|rays|12
player-putouts-15|glove|bolt|wreath|15
player-putouts-18|glove|laurel|laurel|18
player-putouts-20|glove|crown|royal|20
player-assists-5|throw|ball|diagonal|5
player-assists-8|glove|arrow|split|8
player-assists-10|diamond|throw|rays|10
player-assists-12|throw|target|sunburst|12
player-assists-15|handshake|ball|wreath|15
player-assists-18|throw|star|laurel|18
player-assists-20|throw|crown|royal|20
team-double-plays-1|double-play|ball|split|1
team-double-plays-3|diamond|double-play|rays|3
team-double-plays-5|double-play|stars|sunburst|5
team-double-plays-7|shield|double-play|wreath|7
team-double-plays-10|crown|double-play|royal|10
team-triple-plays-1|triple-play|ball|split|1
team-triple-plays-3|diamond|triple-play|rays|3
team-triple-plays-5|triple-play|stars|wreath|5
team-triple-plays-7|crown|triple-play|royal|7
defense-shutout|shield|zero|royal|0
team-buddy-jumps-1|jump|ball|diagonal|1
team-buddy-jumps-3|wings|jump|split|3
team-buddy-jumps-5|jump|stars|sunburst|5
team-buddy-jumps-7|wings|ball|wreath|7
team-buddy-jumps-10|crown|wings|royal|10
team-bobbles-1|slip|ball|diagonal|1
team-bobbles-3|glove|warning|split|3
team-bobbles-5|slip|warning|rays|5
team-bobbles-7|broken-shield|ball|wreath|7
team-bobbles-10|warning|broken-shield|royal|10
team-strikeouts-1|strike|ball|diagonal|1
team-strikeouts-2|pitcher|strike|split|2
team-strikeouts-3|strike|stars|rays|3
team-strikeouts-4|pitcher|target|wreath|4
team-strikeouts-5|crown|strike|royal|5
pitching-iron-arm|pitcher|arm|wings|CG
pitching-superstar-reliever|bullpen|shield|sunburst|RP
playoffs-qualified|pennant|stars|rays|8
playoffs-first-win|trophy|ball|diagonal|W
playoffs-series|trophy|shield|wreath|SER
playoffs-semifinals|star|bracket|sunburst|4
playoffs-finals|stadium|trophy|laurel|FIN
playoffs-champion|crown|trophy|royal|SSL
trade-season-1|handshake|arrow|diagonal|1
trade-season-5|exchange|contract|wreath|5
trade-season-10|handshake|exchange|royal|10
extension-player-1|contract|star|split|1
extension-player-2|two-contracts|handshake|rays|2
extension-player-3|lock|contract|royal|3
extension-stadium|stadium|contract|wreath|EXT
honors-conference|crown|pennant|laurel|CONF
honors-runs-per-game|chart-up|runner|rays|R/G
honors-fewest-runs-allowed|shield|chart-down|wreath|RA
honors-home-runs|ball|chart-up|sunburst|HR
honors-rbis|diamond|crown|laurel|RBI
honors-first-seed|podium|crown|royal|#1
`.trim();

// All keys here MUST exist in src/gm-achievements.js; validation is performed
// against that authoritative file by tests/badge-art-design.mjs.
const rows = DRAWINGS.split('\n').map(line => line.split('|'));
export const badgeScenes = Object.freeze(Object.fromEntries(rows.map(([id, hero, detail, layout, engraving]) => [
  id, Object.freeze({id, hero, detail, layout, engraving})
])));
export const badgeSceneIds = Object.freeze(rows.map(([id])=>id));
