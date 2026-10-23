import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRAFT_STAGES} from '../src/draft-stages.js';

const expected = [
  'Mario Stadium', 'Luigi’s Mansion', 'Yoshi Park', 'Daisy Cruiser',
  'Peach Ice Garden', 'DK Jungle', 'Wario City', 'Bowser Jr’s Playroom',
  'Bowser’s Castle', 'Wii Sports Stadium', 'Cascade Kingdom Stadium',
  'Mario Karting Stadium', 'Toy Field',
];
assert.deepEqual(DRAFT_STAGES, expected, 'The official stadium list must match the published SSL catalog');
assert.equal(new Set(DRAFT_STAGES).size, 13, 'Stadium names must be unique');

const originalDraftMigration = readFileSync(new URL('../supabase/migrations/20261022232000_ssl_stage_draft_12_rounds.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261023042557_ssl_stadium_catalog_and_shared_contract_extensions.sql', import.meta.url), 'utf8');
const catalogMigrations = originalDraftMigration + migration;
for (const stadium of expected) {
  assert(catalogMigrations.includes(stadium), 'Stadium not recognized by database migration: ' + stadium);
}
assert(migration.includes('league_private.ssl_extension_quote'), 'Stadium offers must use the same probability formula as players');
assert(migration.includes('tokens=tokens-1'), 'Stadium offers must consume existing shared contract tokens');
assert(migration.includes('retainedStadiums'), 'Accepted stadiums must carry over to future seasons');

const draftUi = readFileSync(new URL('../src/DraftPlayers.jsx', import.meta.url), 'utf8');
const extensionUi = readFileSync(new URL('../src/ContractExtensions.jsx', import.meta.url), 'utf8');
assert(draftUi.includes('STADIUM PICK'), 'Draft picker should be labeled Stadium Pick');
assert(extensionUi.includes('ssl_stadium_extension_preview'), 'Stadium preview must be available');
assert(extensionUi.includes('extension_stadium'), 'Stadium retention action must be wired');
assert(draftUi.includes('<th>Player / Stadium</th>'), 'Draft results must identify Stadium selections, not just players');

const rulesUi = readFileSync(new URL('../src/LeagueRules.jsx', import.meta.url), 'utf8');
assert(rulesUi.includes('one nontradable Stadium Pick'), 'Rules must call the protected pick a Stadium Pick');
assert(rulesUi.includes('an owned Stadium using the same repeat-offer percentages'), 'Rules must extend the player acceptance odds to Stadiums');
const retainedStadiumMigration = readFileSync(new URL('../supabase/migrations/20261023050000_ssl_retained_stadium_skips_draft_pick.sql', import.meta.url), 'utf8');
assert(retainedStadiumMigration.includes("if r=12 and jsonb_array_length"), 'Retained Stadiums must remove the next nontradable Stadium Pick');
const stadiumLabelMigration = readFileSync(new URL('../supabase/migrations/20261023054917_ssl_stadium_selection_label.sql', import.meta.url), 'utf8');
assert(stadiumLabelMigration.includes('Choose a Stadium from the official Stadium list'), 'Backend messages must use Stadium terminology');

console.log('SSL Stadium catalog, names, and shared-extension contract invariants validated.');
