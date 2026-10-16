# Supa Sports Network installable app

The site is installable at its existing GitHub Pages address. Its web manifest uses relative URLs, so the app start URL, ID, icons and scope stay inside `/supa-sports-network/` in production and `/` in local builds. The full existing SSL diamond badge is reused for the app icons; the wordmark stays on the website.

Use **Install App** near the site footer. Browsers exposing `beforeinstallprompt` get a native install button. On iPhone/iPad, use Safari → Share → Add to Home Screen, with Open as Web App enabled when shown. Mac Safari uses File → Add to Dock. Installed windows hide the install promotion. An installed app may require a fresh sign-in; it uses the same Supabase accounts and league records.

The production-only service worker caches one public, self-contained reconnect page. It never caches the application HTML, API responses, sign-in details, private reports, or player data. Online navigations always go to the network. Offline navigations within the site scope show the reconnect page, with retry and automatic reconnect. Failed API calls are left to the existing application error handling. No offline drafts or roster mutations are queued.

The Vite build emits `sw.js` with a version based on the built filenames and offline page. The worker removes only old caches with its own `ssn-offline-` prefix. Normal site builds provide app updates; no store submission is needed.

Validation: build with `GITHUB_PAGES_BASE=/supa-sports-network/ npm run build`, then serve with `GITHUB_PAGES_BASE=/supa-sports-network/ npm run preview -- --host 127.0.0.1`. Check the manifest and icon URLs, Chromium installability, mobile install help, keyboard dismissal, offline navigation/retry/reconnect, and that Cache Storage contains only `offline.html`. A real device still requires its user to confirm installation.
