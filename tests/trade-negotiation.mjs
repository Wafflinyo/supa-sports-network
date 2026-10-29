import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Contracts for live Season 1 trading. This test must not modify a season or a draft.
const sql=readFileSync(new URL('../supabase/migrations/20261029205500_ssl_postdraft_trades_and_negotiations.sql',import.meta.url),'utf8');
const src=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const previous=readFileSync(new URL('../supabase/migrations/20261029181000_ssl_publish_undated_fantasy_locks.sql',import.meta.url),'utf8');

for(const check of [
 ['postdraft trading opens immediately when draft ends', /''postdraft'',''needsDefault'',st->''order'',''tradingOpen'',true/],
 ['existing Season 1 goes live without regenerating picks or calendar', /where number=1[\s\S]*state->>'status'='postdraft'[\s\S]*jsonb_array_length\(coalesce\(state->'picks'/],
 ['messages stored in league-private schema', /create table if not exists league_private\.ssl_trade_messages/],
 ['no public direct table grants', /revoke all on league_private\.ssl_trade_messages from public,anon,authenticated/],
 ['messages table protected by RLS', /alter table league_private\.ssl_trade_messages enable row level security/],
 ['identity supplied by verified session', /league_private\.current_access\(\)/],
 ['authenticated GM or commissioner only', /auth\.uid\(\) is null or coalesce\(a->>'role',''\) not in \('gm','commissioner'\)/],
 ['participant-only trade conversation access', /not o\.body->'teams' @> jsonb_build_array\(f::text\)/],
 ['private thread uses scoped season and offer', /where offer_id=target_offer and season=target_season/],
 ['trade cancellations require participant permission', /not o\.body->'teams' @> jsonb_build_array\(actor_team::text\)/],
 ['only pending or ready offers are editable', /o\.status not in \('pending','ready'\)/],
 ['edited proposals reset accepted GMs', /accepted=case when actor_team is null then '\[\]'::jsonb/],
 ['revised offers reset to pending', /status='pending'/],
 ['proposal revision race is detected', /expectedRevision/],
 ['duplicate assets rejected in revised offers', /move_key=any\(seen_keys\)/],
 ['messages include a max length', /char_length\(txt\) not between 1 and 1000/],
 ['message spam is throttled', /interval '5 seconds'/],
 ['messages cannot be read using anonymous role', /public\.ssl_trade_thread\(uuid,uuid\) from public,anon,authenticated/],
 ['public RPC only for authenticated role', /public\.ssl_trade_thread\(uuid,uuid\) to authenticated/],
 ['existing manager delegates only new negotiation operations', /if op in \(''trade_message'',''edit_trade'',''cancel_trade''\)/]
]){
 assert(check[1].test(sql),'Missing safe trade contract: '+check[0]);
}
assert(!/update league_private\.ssl_season_states[\s\S]*'rosters'/.test(sql),
 'Trade activation must not rewrite existing drafted rosters');
assert(!/delete from league_private\.ssl_offers/.test(sql),
 'Trade migration must not delete historical offers');
assert(sql.includes('league_private.ssl_manage_core(text,uuid,jsonb)'),
 'Only the original draft-completion function should be selectively updated');
for(const part of [
 "function TradeConversation({league:l,offer,teamName})",
 "rpc('ssl_trade_thread'",
 "l.act('trade_message'",
 "l.act(counter ? \"edit_trade\" : \"submit_trade\"",
 "expectedRevision:counter.revision",
 "setCounter({id:o.id,revision:Number(o.body.revision)||0})",
 "OPEN PRIVATE TRADE NEGOTIATION",
 "SAVE REVISED PROPOSAL",
 "CANCEL PROPOSAL",
 "(admin || o.body.teams.includes(team))"
]){
 assert(src.includes(part),'Trade UI is missing '+part);
}
assert(src.includes('setInterval(refreshThread,5000)'),
 'An open conversation should refresh as the other GM messages');
assert(src.includes("setHistory(Array.isArray(r.data)?r.data:[])"),
 'Messages should load directly from authenticated trade thread RPC');
assert(!src.includes('counterTo: counter'),
 'Revising an offer must preserve the existing private conversation');
// The commissioner sees all submitted trade terms in Commissioner Tools only.
// The existing secure inbox RPC returns all season offers to the commissioner,
// while GMs continue to receive just their teams' proposals.
const inboxSql=readFileSync(new URL('../supabase/migrations/20261016025833_ssl_season_workflows.sql',import.meta.url),'utf8');
assert(inboxSql.includes("a->>'role'='commissioner' or o.body->'teams'"),
 'Commissioner inbox must not be filtered to a single franchise');
assert(src.includes('{tab === "Trades" && <Trades league={l} commissionerTools />}'),
 'Commissioner Tools Trades tab must use the special all-proposals view');
const overviewStart=src.indexOf('function CommissionerTradeOverview(');
const overviewEnd=src.indexOf('function TradeConversation(',overviewStart);
assert(overviewStart>=0&&overviewEnd>overviewStart,
 'Commissioner trade overview must be a separate component');
const overview=src.slice(overviewStart,overviewEnd);
for(const token of ['ALL TEAM TRADE PROPOSALS','l.inbox',
 'o.body.revision','o.body.teams','showMoves(o.body)','o.body.note',
 'o.accepted','APPROVE & PROCESS TRADE','VIEW PREVIOUS / CLOSED PROPOSALS']){
 assert(overview.includes(token),'Commissioner proposal view missing '+token);
}
assert(!overview.includes('TradeConversation')&&!overview.includes('ssl_trade_thread')&&
 !overview.includes('trade_message'),
 'Commissioner proposal view must never request or render negotiation messages');
assert(src.includes('{commissionerTools && admin &&') &&
 src.includes('<CommissionerTradeOverview league={l}'),
 'Commissioner overview must be gated by the commissioner role');
assert(src.includes('{!commissionerTools && <Box title="YOUR TRADE INBOX">'),
 'Commissioner Tools should not duplicate the GM inbox');
assert(src.includes('{!admin && <TradeConversation'),
 'GM negotiation controls must not be shown to commissioner accounts');
assert(previous.includes('ssl_manage_calendar'),
 'Existing public TBD schedule migration remains intact');
console.log('PASS: secure GM trades and commissioner all-proposals dashboard, no conversation in commissioner tools, draft preserved');
