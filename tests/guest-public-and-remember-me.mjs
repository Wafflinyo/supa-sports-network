import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLeagueAuthStorage} from '../src/league-auth-storage.js';
import {publicLeagueSeasons} from '../src/public-league-view.js';

function fakeStore() {
  const values = new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
}
const local=fakeStore(),session=fakeStore();
let auth=createLeagueAuthStorage('https://vocaddalptoghysgdkvh.supabase.co',{local,session});
const key=auth.authKey;
assert.equal(key,'sb-vocaddalptoghysgdkvh-auth-token');
assert.equal(auth.getKeepSignedIn(),false,'Default new logins are only for the browser session');
auth.storage.setItem(key,'short-session');
assert.equal(session.getItem(key),'short-session');
assert.equal(local.getItem(key),null);
assert.equal(auth.storage.getItem(key),'short-session');
auth.setKeepSignedIn(true);
assert.equal(session.getItem(key),null,'Persistent mode moves existing credentials out of session storage');
assert.equal(local.getItem(key),'short-session');
auth.storage.setItem(key,'refreshed-session');
assert.equal(local.getItem(key),'refreshed-session','Refresh tokens stay persistent when selected');
auth=createLeagueAuthStorage('https://vocaddalptoghysgdkvh.supabase.co',{local,session});
assert.equal(auth.getKeepSignedIn(),true,'Remembered users retain session mode on reload');
assert.equal(auth.storage.getItem(key),'refreshed-session');
auth.setKeepSignedIn(false);
assert.equal(local.getItem(key),null);
assert.equal(session.getItem(key),'refreshed-session');
auth.storage.setItem(key,'tab-only-refresh');
assert.equal(session.getItem(key),'tab-only-refresh');
auth.storage.removeItem(key);
assert.equal(session.getItem(key),null);
assert.equal(local.getItem(key),null,'Sign out clears both potential storage locations');
auth.storage.setItem(key,'short-session');
const nextTab=createLeagueAuthStorage('https://vocaddalptoghysgdkvh.supabase.co',{local,session:fakeStore()});
assert.equal(nextTab.storage.getItem(key),null,'Unchecked logins do not follow visitors to a new tab or browser session');

const fixture=[{id:'season1',preseasonResults:[{match_key:'R4-1'}],preseasonReports:[{gameId:'published'}],games:[
  {id:'private',stage:'recorded',result:{scores:{a:5,b:4}},story:{spoiler:'secret'}},
  {id:'released',stage:'final',result:{scores:{a:5,b:4}}},
]}];
const publicData=publicLeagueSeasons(fixture);
assert.equal(publicData[0].preseasonResults.length,1);
assert.equal(publicData[0].preseasonReports.length,1);
assert.equal(publicData[0].games[0].result,undefined);
assert.equal(publicData[0].games[0].story,undefined);
assert.equal(publicData[0].games[1].result.scores.a,5);
assert.equal(fixture[0].games[0].result.scores.a,5,'Private source is not mutated');

const app=fs.readFileSync('src/main.jsx','utf8');
const league=fs.readFileSync('src/SeasonLeague.jsx','utf8');
const dialog=fs.readFileSync('src/LeagueAccount.jsx','utf8');
assert.match(app,/createLeagueAuthStorage\(url\)/);
assert.match(app,/auth:\s*\{\s*storageKey:\s*authStorage\.authKey,\s*storage:\s*authStorage\.storage/);
assert.match(app,/onKeepSignedIn=\{value=>authStorage\?\.setKeepSignedIn\(value\)\}/);
assert.match(dialog,/id="account-keep-signed-in"/);
assert.match(dialog,/onKeepSignedIn\?\.\(mode==='login' && keepSignedIn\)/);
assert.match(league,/access\.signedIn \? supabase : \(publicSupabase \|\| supabase\)/);
assert.match(league,/reader\.rpc\("ssl_seasons"\)/);
assert.match(league,/reader\.rpc\('ssl_preseason_published_reports'/);
assert.match(league,/publicLeagueSeasons\(seasons\)/);
console.log('PASS: opt-in persistent sessions, guest-only session lifetime, logout cleanup, public released data and private report embargo');
