import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshSiteUrl,refreshSite} from '../src/site-refresh.js';

const base='https://league.example/supa-sports-network/?page=Home#stats';
const first=freshSiteUrl(base,1730670000000);
assert.equal(first,'https://league.example/supa-sports-network/?page=Home&ssl_refresh=1730670000000#stats',
  'Cache-busting refresh must preserve site path, existing query and hash');
assert.equal(freshSiteUrl(first,1730670000123),
  'https://league.example/supa-sports-network/?page=Home&ssl_refresh=1730670000123#stats',
  'Repeated refreshes replace, not duplicate the cache-buster');
assert.notEqual(freshSiteUrl(base,1),freshSiteUrl(base,2),
  'Each refresh must be able to request a new copy of deployed HTML');
const location={href:base,replace(url){this.replaced=url}};
refreshSite(location,1730670000123);
assert.equal(location.replaced,freshSiteUrl(base,1730670000123),
  'Clicking the Refresh Site button must initiate a real full page navigation');
const header=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert.match(header,/aria-label="Refresh Site"[^>]*onClick=\{\(\)=>refreshSite\(window\.location\)\}/,
  'Refresh button is wired to full-site reload rather than in-memory data reload');
assert.match(header,/className="ssl-refresh-site"/,
  'Site refresh must appear in the header for signed-out visitors, GMs and commissioner');
assert.match(readFileSync(new URL('../src/site-refresh.css',import.meta.url),'utf8'),
  /@media\(max-width:700px\)/,'Refresh Site control must fit on a phone screen');
const serviceWorker=readFileSync(new URL('../pwa/sw.js',import.meta.url),'utf8');
assert.match(serviceWorker,/event\.respondWith\(fetch\(event\.request\)/,
  'The installed PWA must use network-first navigation to fetch deployed updates');
console.log('PASS: visible header refresh, cache-busting page reload, mobile layout and network-first PWA behavior.');
