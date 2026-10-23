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

const migration = readFileSync(new URL('../supabase/migrations/20261023042557_ssl_stadium_catalog_and_shared_contract_extensions.sql', import.meta.url), 'utf8');
for (const stadium of expected) {
  assert(migration.includes(stadium), 'Stadium not recognized by database migration: ' + stadium);
}
assert(migration.includes('league_private.ssl_extension_quote'), 'Stadium offers must use the same probability formula as players');
assert(migration.includes('tokens=tokens-1'), 'Stadium offers must consume existing shared contract tokens');
assert(migration.includes('retainedStadiums'), 'Accepted stadiums must carry over to future seasons');

const draftUi = readFileSync(new URL('../src/DraftPlayers.jsx', import.meta.url), 'utf8');
const extensionUi = readFileSync(new URL('../src/ContractExtensions.jsx', import.meta.url), 'utf8');
assert(draftUi.includes('STADIUM PICK'), 'Draft picker should be labeled Stadium Pick');
assert(extensionUi.includes('ssl_stadium_extension_preview'), 'Stadium preview must be available');
assert(extensionUi.includes('extension_stadium'), 'Stadium retention action must be wired');

console.log('SSL Stadium catalog, names, and shared-extension contract invariants validated.');
