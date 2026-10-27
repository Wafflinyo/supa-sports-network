import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const stats=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const draft=readFileSync(new URL('../src/DraftPlayers.jsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/draft-players.css',import.meta.url),'utf8');
const portraits=readFileSync(new URL('../src/PlayerPortrait.jsx',import.meta.url),'utf8');
assert(stats.includes('<PlayerAvatar player={p}/>'),'Stats uses shared PlayerPortrait via PlayerAvatar');
assert(stats.includes("function PlayerAvatar({ player, size = 38 })"),'Stats icon default is 38px');
assert(draft.includes('<PlayerPortrait player={p} size={38}/>'),'Draft must use identical source and display scale');
assert(draft.includes('<PlayerPriority player={p}/>'),'Draft must share the Stats pitching-priority badge');
assert(draft.includes('className="draft-player-stats-identity player-data-name"'),'Stats identity layout should be reused');
assert(styles.includes('draft-player-stats-card'),'Draft card styling should match stats row presentation');
assert(portraits.includes('playerPortraitStyle(player,size)'),'both derive artwork from the same portrait mapping');
assert(!draft.includes('<PlayerPortrait player={p} size={56}/>'));
const confirmation=draft.indexOf("const confirmed=window.confirm('Draft '+selected.name");
const submit=draft.indexOf("if(await l.act('pick',{player:selected.id}))close();");
assert(confirmation>0,'player Draft button must request explicit confirmation');
assert(draft.slice(confirmation,submit).includes('if(!confirmed)return;'),
  'canceling the player confirmation must never submit a pick');
assert(submit>confirmation,'submission must occur after confirmation and not on card tap');
assert(draft.includes("if(!canPick||l.busy||mustStage||ownership.has(selected.id))return;"),
  'guard paused, unavailable, duplicate and busy pick attempts');
assert(draft.includes("window.confirm('Draft '+selectedStadium"),
  'existing Stadium confirmation must remain available');
console.log('PASS: Draft Player Stats portraits, priority badges and two-step confirmed player/stadium picks');
