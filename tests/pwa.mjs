import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const html = fs.readFileSync('dist/index.html', 'utf8')
const manifestPath = html.match(/rel="manifest" href="([^"]+)"/)[1]
const base = new URL('./', new URL(manifestPath, 'https://example.test'))
const manifest = JSON.parse(fs.readFileSync('dist/manifest.webmanifest', 'utf8'))
assert.equal(manifest.display, 'standalone')
assert.equal(new URL(manifest.start_url, base).href, base.href)
assert.equal(new URL(manifest.scope, base).href, base.href)
for (const icon of manifest.icons) {
  const png = fs.readFileSync('dist/' + icon.src)
  assert.equal(png.subarray(1,4).toString(), 'PNG')
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
}
assert(manifest.icons.some(i => i.sizes === '192x192' && i.purpose === 'any'))
assert(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'))
assert(manifest.icons.some(i => i.purpose === 'maskable'))
assert(html.includes('apple-touch-icon'))

const handlers = {}, stores = new Map([['another-app-cache',new Map()],['ssn-offline-old',new Map()]])
let disconnected = false, claimed = false
const offlinePage = new Response(fs.readFileSync('dist/offline.html'), {headers:{'Content-Type':'text/html'}})
const cacheAPI = {
  keys: async () => [...stores.keys()],
  delete: async name => stores.delete(name),
  open: async name => {
    if (!stores.has(name)) stores.set(name,new Map())
    const store = stores.get(name)
    return {add: async req => store.set(req.url,offlinePage),match: async url => store.get(url)}
  },
}
vm.runInNewContext(fs.readFileSync('dist/sw.js','utf8'), {
  self:{location:{href:new URL('sw.js',base).href},addEventListener:(event,handler)=>handlers[event]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}},
  URL,Request,Response,caches:cacheAPI,
  fetch: async request => {if(disconnected)throw Error('offline');return new Response('Current network content')},
})
await new Promise((resolve,reject)=>handlers.install({waitUntil:p=>p.then(resolve,reject)}))
await new Promise((resolve,reject)=>handlers.activate({waitUntil:p=>p.then(resolve,reject)}))
assert(claimed)
assert(stores.has('another-app-cache'))
assert(!stores.has('ssn-offline-old'))
assert.deepEqual([...stores].filter(([k])=>k.startsWith('ssn-offline-')).flatMap(([,v])=>[...v.keys()]),[new URL('offline.html',base).href])
const request = (url,mode='navigate',method='GET')=>({url,mode,method})
let response
handlers.fetch({request:request(base.href),respondWith:p=>response=p})
assert.equal(await (await response).text(),'Current network content')
disconnected=true
handlers.fetch({request:request(base.href),respondWith:p=>response=p})
assert((await (await response).text()).includes('BACK IN THE GAME'))
for(const r of [request('https://db.supabase.co/rest/v1/private','cors'),request(new URL('account',base).href,'cors','POST'),request('https://example.test/another-app/'),request(new URL('assets/app.js',base).href,'cors')]) {
  let intercepted=false;handlers.fetch({request:r,respondWith:()=>intercepted=true});assert(!intercepted)
}
console.log('PASS: app-scoped manifest, icon sizes, offline fallback, network-first navigations, unrelated caches preserved, and API/non-navigation requests untouched.')
