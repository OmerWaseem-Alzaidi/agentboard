#!/usr/bin/env node
/**
 * Fetches production index.html and prints referenced /assets/*.js URLs.
 * Use after deploy: if the main chunk hash never changes, the CDN/browser is stale or the wrong URL.
 *
 * Usage: node scripts/check-production-bundle.mjs [url]
 *    or: npm run check:prod -- https://your-app.vercel.app
 */
const url = (process.argv[2] || 'https://agentboard-5b9aqf4fu-versity.vercel.app').replace(/\/$/, '')

const res = await fetch(url, {
  headers: { Accept: 'text/html' },
})
if (!res.ok) {
  console.error('HTTP', res.status, url)
  if (res.status === 401 || res.status === 403) {
    console.error(
      '\nVercel may be blocking unauthenticated requests (Deployment Protection / SSO).\n' +
        'Use: Project Settings → Deployment Protection → allow public access for Production,\n' +
        'or run this script against a public preview URL / after passing a session cookie.'
    )
  }
  process.exit(1)
}
const html = await res.text()
const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
const css = [...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1])

console.log('URL:', url)
console.log('JS:', scripts.length ? scripts.join('\n     ') : '(none found — unexpected HTML?)')
if (css.length) console.log('CSS:', css.join('\n      '))

const main = scripts.find((s) => /index-[\w-]+\.js$/i.test(s) || /\/index-/.test(s)) ?? scripts[0]
if (main?.includes('BYO1oV6C')) {
  console.warn('\n⚠️  Still serving chunk hash BYO1oV6C — deploy/cache: push latest, Vercel Redeploy (no cache), hard refresh.')
}
