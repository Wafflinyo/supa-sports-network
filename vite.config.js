import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || '/',
  plugins: [{
    name: 'ssn-installable-app',
    apply: 'build',
    generateBundle(_, bundle) {
      const version = createHash('sha256').update(Object.keys(bundle).sort().join('|')).update(readFileSync(new URL('./public/offline.html', import.meta.url))).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: readFileSync(new URL('./pwa/sw.js', import.meta.url), 'utf8').replace('__BUILD_ID__', version) })
    },
  }],
})
