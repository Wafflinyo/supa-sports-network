import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const portrait=file('PlayerPortrait.jsx');
const links=file('PlayerProfileLink.jsx');
const teams=file('SeasonLeague.jsx');
const stats=file('main.jsx');
const data=file('PlayerData.jsx');
const modal=file('PlayerProfile.jsx');
const headlines=file('HomeHeadliners.jsx');
const myTeam=file('MyDraftTeam.jsx');

// A plain portrait remains the ONLY Hot badge in the main Player Stats table.
assert.match(stats,/<td className="player-cell"><PlayerAvatar player=\{p\}\/><strong>\{p.name\}<\/strong>/);
assert.match(portrait,/const contextAllowsPortraitHeat=useContext\(PortraitFlameContext\)/);
assert.match(portrait,/showHeat&&contextAllowsPortraitHeat&&<HeatMark playerId=\{player.id\}\/>/);

// Links display their single flame alongside their label, never on the portrait.
assert.match(links,/<PortraitFlameContext.Provider value=\{false\}>\{children\}<\/PortraitFlameContext.Provider>/);
assert.match(links,/showHeatMark&&<HeatMark playerId=\{player.id\} inline\/>/);
assert.match(data,/<PlayerProfileLink player=\{p\} className="player-data-name">/);
assert.match(myTeam,/<PlayerProfileLink player=\{player\} className="my-draft-team-card"/);

// On the Teams tab, the inline flame is immediately after the NAME, before P1P/P2P.
assert.match(teams,/<PlayerProfileLink player=\{p\} className="portrait-label" showHeatMark=\{false\}>[\s\S]*?\{p\?\.name \|\| 'Unknown player'\}[\s\S]*?<HeatMark playerId=\{p.id\} inline\/>[\s\S]*?<PitcherPriorityBadge/);
assert.match(teams,/<Player id=\{p.player\} seasons=\{l.seasons\}\/>/);

// These two views used to display a second inline flame next to an already-flaming portrait.
assert.doesNotMatch(data,/<h3>\{player.name\} <HeatMark/);
assert.doesNotMatch(modal,/<h2 id="career-player-name">\{player.name\}<\/h2><HeatMark/);

// Homepage headline leaders keep their own game-specific flame, not a second portrait flame.
assert.match(headlines,/size=\{32\} showHeat=\{false\}\/>/);
assert.match(headlines,/p.heatingUp&&<span className="ssl-headliner-hot"/);

console.log('PASS: Teams has one name-side flame, Player Stats preserves one portrait flame, and no duplicate flames on linked cards, profile or headlines');
