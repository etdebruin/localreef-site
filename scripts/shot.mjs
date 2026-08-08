/**
 * Photograph the site.
 *
 * Borrowed wholesale from Local Reef itself, where looking at the thing
 * caught two bugs that a green test suite did not. Same idea here: a
 * headless Chrome over the DevTools protocol, one browser, many frames.
 *
 *   node scripts/shot.mjs                 # every named state
 *   node scripts/shot.mjs hero contribute # only those
 *
 * Output lands in .shots/.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = 8912
const WIDTH = Number(process.env.W ?? 1440)
const HEIGHT = Number(process.env.H ?? 980)
const SCALE = Number(process.env.SCALE ?? 1.5)

/** Every capture: a named vertical position on the page. */
const STATES = {
  hero: { at: 0 },
  problem: { anchor: '#problem' },
  apps: { anchor: '#apps' },
  gateway: { anchor: '#how' },
  notes: { anchor: '#notes' },
  contribute: { anchor: '#contribute' },
  floor: { at: 'bottom' },
}

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.woff2': 'font/woff2', '.json': 'application/json',
}

// ── a static server, because file:// blocks the font stylesheet ──────
function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0]))
    if (path.includes('..')) { res.writeHead(403).end(); return }
    let file = join(ROOT, path === '/' ? 'index.html' : path)
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((ok) => server.listen(PORT, '127.0.0.1', () => ok(server)))
}

// ── minimal CDP client ──────────────────────────────────────────────
function connect(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  let next = 1
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
  })
  const ready = new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true })
    ws.addEventListener('error', () => no(new Error('devtools socket failed')), { once: true })
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = next++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  return { ready, send, close: () => ws.close() }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  for (const c of candidates) { try { await stat(c); return c } catch {} }
  throw new Error('no Chrome found; install Google Chrome or set one of the known paths')
}

const wanted = process.argv.slice(2)
const states = Object.entries(STATES).filter(([n]) => !wanted.length || wanted.includes(n))
if (!states.length) {
  console.error(`unknown state. known: ${Object.keys(STATES).join(', ')}`)
  process.exit(1)
}

const server = await serve()
await mkdir(join(ROOT, '.shots'), { recursive: true })

const profile = join(ROOT, '.shots', '.profile')
await rm(profile, { recursive: true, force: true })

const chrome = spawn(await findChrome(), [
  '--headless=new',
  '--remote-debugging-port=9333',
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--force-color-profile=srgb',
  `--window-size=${WIDTH},${HEIGHT}`,
  'about:blank',
], { stdio: 'ignore' })

// Poll for the debugging endpoint rather than sleeping a fixed amount.
let target
for (let i = 0; i < 60 && !target; i++) {
  await wait(250)
  try {
    const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
    target = list.find((t) => t.type === 'page')
  } catch {}
}
if (!target) { chrome.kill(); server.close(); throw new Error('chrome never came up') }

const cdp = connect(target.webSocketDebuggerUrl)
await cdp.ready
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: false,
})
await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` })
await wait(2600) // fonts, the reef image, and the first reveal pass

for (const [name, spec] of states) {
  // `behavior: instant` on purpose: the stylesheet sets smooth scrolling,
  // and a capture fired mid-animation lands between two sections.
  const expr = spec.anchor
    ? `scrollTo({top: document.querySelector('${spec.anchor}').getBoundingClientRect().top + scrollY - 80, behavior: 'instant'})`
    : spec.at === 'bottom'
      ? `scrollTo({top: document.body.scrollHeight, behavior: 'instant'})`
      : `scrollTo({top: ${spec.at ?? 0}, behavior: 'instant'})`
  await cdp.send('Runtime.evaluate', { expression: expr })
  await wait(1100) // let the reveal transitions finish
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const out = join(ROOT, '.shots', `${name}.png`)
  await writeFile(out, Buffer.from(data, 'base64'))
  console.log(`  ✓ .shots/${name}.png`)
}

cdp.close()
chrome.kill()
server.close()
