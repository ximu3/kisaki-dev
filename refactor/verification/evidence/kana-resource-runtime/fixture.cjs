// Static assets are served locally; virtual book paths are never served by this handler.
const fs = require('node:fs')
const path = require('node:path')
exports.createFixture = () => {
  const requests = []
  const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8')
  const host =
    '<!doctype html><meta charset="utf-8"><script src="/bridge.js"></script><script src="/owner.js"></script><script src="/storage.js"></script><script src="/cases.js"></script><body></body>'
  const scripts = Object.fromEntries(
    ['bridge.js', 'owner.js', 'cases.js', 'worker.js', 'storage.js'].map((file) => [
      file,
      read(file)
    ])
  )
  const pwa = `self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
self.addEventListener('fetch',event=>{
if(new URL(event.request.url).pathname==='/pwa-ping')event.respondWith(new Response('pwa-owner'));
else event.respondWith(fetch(event.request));
});`
  const response = (url) => {
    requests.push(url.pathname)
    const ok = (body, type, headers = {}) => ({
      status: 200,
      body,
      headers: { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers }
    })
    if (url.pathname === '/host.html' || url.pathname === '/blocked.html') {
      return ok(
        host,
        'text/html; charset=utf-8',
        url.pathname === '/blocked.html'
          ? {
              'Content-Security-Policy': "default-src 'self'; script-src 'self'; worker-src 'none'"
            }
          : {}
      )
    }
    if (url.pathname === '/pwa.js')
      return ok(pwa, 'text/javascript', { 'Service-Worker-Allowed': '/' })
    if (url.pathname === '/foreign.js')
      return ok("self.addEventListener('fetch',()=>{});", 'text/javascript', {
        'Service-Worker-Allowed': '/'
      })
    if (url.pathname === '/other-owner.js') {
      return ok(
        scripts['owner.js'].replace('globalThis.runtimeProbe =', 'globalThis.otherProbe ='),
        'text/javascript'
      )
    }
    const local = /^\/(bridge|owner|storage|cases)\.js$/.exec(url.pathname)
    if (local) return ok(scripts[local[1] + '.js'], 'text/javascript')
    const asset = /^\/assets\/[a-z0-9-]+\/(worker|bridge)\.js$/.exec(url.pathname)
    if (asset) {
      return {
        ...ok(scripts[asset[1] + '.js'], 'text/javascript'),
        delay: url.pathname === '/assets/install-slow/worker.js' ? 250 : 0
      }
    }
    return {
      status: 404,
      body: '',
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
    }
  }
  return { response, requests }
}
