/**
 * Assertions about the rendered page, not about the source.
 *
 * The distinction matters. Checking that a rule exists in the stylesheet proves
 * nothing about what a visitor sees: a later rule, a wrong selector, or a cascade
 * order all pass that check and ship broken. Everything here measures the
 * computed result in a real browser at four viewport widths.
 *
 * Contrast is measured against **the pixels actually painted behind the text**.
 * The obvious version of this check reads `getComputedStyle(el).color` and the
 * ancestors' `background-color` and does the maths, and it is worthless on this
 * page: the colours are `oklch()`, which Chrome serialises as `oklch(...)`, so
 * a naive rgb parse reads `0.815 0.023 205` as a near-black RGB triple and every
 * single element "fails" at 1.25:1. Worse, the page's background is a gradient,
 * so there is no `background-color` to read at all. The only honest source is a
 * screenshot, decoded back into the page and sampled.
 *
 *   node scripts/check.mjs
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, stat, rm } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = 8913
const BASE = `http://127.0.0.1:${PORT}`

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

const server = await new Promise((ok) => {
  const s = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0]))
    if (path.includes('..')) { res.writeHead(403).end(); return }
    let file = join(ROOT, path === '/' ? 'index.html' : path)
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(await readFile(file))
    } catch { res.writeHead(404).end() }
  })
  s.listen(PORT, '127.0.0.1', () => ok(s))
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function findChrome() {
  for (const c of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]) { try { await stat(c); return c } catch {} }
  throw new Error('no Chrome found')
}

const profile = join(ROOT, '.shots', '.check-profile')
await rm(profile, { recursive: true, force: true })
const chrome = spawn(await findChrome(), [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' })

let target
for (let i = 0; i < 60 && !target; i++) {
  await wait(250)
  try {
    const list = await (await fetch('http://127.0.0.1:9334/json/list')).json()
    target = list.find((t) => t.type === 'page')
  } catch {}
}
if (!target) { chrome.kill(); server.close(); throw new Error('chrome never came up') }

const ws = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let next = 1
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  const p = pending.get(m.id)
  if (!p) return
  pending.delete(m.id)
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
})
await new Promise((ok, no) => {
  ws.addEventListener('open', ok, { once: true })
  ws.addEventListener('error', () => no(new Error('socket failed')), { once: true })
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = next++
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  }
  return result.value
}

let bad = 0
const fail = (msg) => { console.log(`    ✗ ${msg}`); bad++ }
const pass = (msg) => console.log(`    ✓ ${msg}`)

// ── layout, links, alt text, fonts ─────────────────────────────────────
const LAYOUT = `(() => {
  const fails = []
  const px = (n) => Math.round(n)

  // Nothing may make the document itself scroll sideways.
  if (document.documentElement.scrollWidth > innerWidth + 1) {
    fails.push('page scrolls horizontally: ' +
      document.documentElement.scrollWidth + ' > ' + innerWidth)
  }

  // Wide content is allowed past the fold only if something clips it.
  const clipped = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true
    }
    return false
  }
  for (const el of document.querySelectorAll('pre, .diagram, .plate-frame')) {
    const r = el.getBoundingClientRect()
    if (r.right > innerWidth + 1 && !clipped(el)) {
      fails.push(el.className || el.tagName.toLowerCase() +
        ' runs past the viewport with nothing clipping it: right=' + px(r.right))
    }
  }

  // The h1 must not start underneath the fixed nav.
  const nav = document.querySelector('.nav').getBoundingClientRect()
  const h1 = document.querySelector('h1').getBoundingClientRect()
  if (h1.top < nav.bottom) fails.push('h1 sits under the nav')

  // Alt on every image; decorative ones must be empty, not absent.
  for (const img of document.images) {
    if (img.getAttribute('alt') === null) fails.push('image has no alt: ' + img.src)
  }

  // Links must go somewhere.
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href')
    if (!h || h === '#') fails.push('empty link: ' + a.textContent.trim().slice(0, 30))
  }

  // The fonts we chose must be the fonts in use, not a silent fallback.
  const want = {
    h1: 'Bricolage Grotesque',
    '.lede': 'Golos Text',
    '.plate figcaption': 'Spline Sans Mono',
  }
  for (const [sel, family] of Object.entries(want)) {
    const el = document.querySelector(sel)
    if (!el) { fails.push('missing element for font check: ' + sel); continue }
    if (!getComputedStyle(el).fontFamily.includes(family)) {
      fails.push(sel + ' is not ' + family)
    }
  }

  // Every image has to load. Lazy ones below the fold have not started yet,
  // so ask for their bytes rather than reading .complete and calling a
  // not-yet-requested image broken.
  return Promise.all([...document.images].map(async (img) => {
    if (img.complete && img.naturalWidth > 0) return null
    const r = await fetch(img.currentSrc || img.src, { method: 'HEAD' })
    return r.ok ? null : 'image ' + r.status + ': ' + img.src
  })).then((rs) => fails.concat(rs.filter(Boolean)))
})()`

// ── contrast, from the painted pixels ──────────────────────────────────
const TARGETS = [
  ['.lede', 4.5], ['.meta', 4.5], ['.two p', 4.5], ['.specimen p', 4.5],
  ['.aside', 4.5], ['.entries p', 4.5], ['.wants p', 4.5],
  ['.start-rules p', 4.5], ['.grid-notes p', 4.5], ['.ways span', 4.5],
  ['.floor-note', 4.5], ['.plate figcaption', 4.5], ['.nav nav a', 4.5],
  ['.floor-links a', 4.5], ['.gauge-read', 4.5], ['.tag', 4.5],
  ['h1 .l1', 3], ['h1 .l3', 3], ['.section-head', 3], ['.pull p', 3],
  ['.specimen-num', 3],
]

/** Resolve any CSS colour to sRGB bytes by letting the canvas do it. */
const RESOLVE = `(css) => {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const x = c.getContext('2d')
  x.fillStyle = '#000'
  x.fillRect(0, 0, 1, 1)
  x.fillStyle = css
  x.fillRect(0, 0, 1, 1)
  return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3)
}`

async function contrastOf(sel) {
  const box = await evaluate(`(() => {
    const el = document.querySelector('${sel}')
    if (!el) return null
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
    const r = el.getBoundingClientRect()
    const resolve = ${RESOLVE}
    return {
      fg: resolve(getComputedStyle(el).color),
      x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)),
      w: Math.min(Math.round(r.width), innerWidth - Math.round(r.left)),
      h: Math.min(Math.round(r.height), innerHeight - Math.round(r.top)),
    }
  })()`)
  if (!box || box.w < 4 || box.h < 4) return { missing: !box }

  const { data } = await send('Page.captureScreenshot', { format: 'png' })

  // Feed the screenshot back into the page so Chrome decodes it, then take
  // the modal colour inside the element's box. Glyphs are a minority of the
  // pixels in a text box, so the mode is the background it sits on.
  return evaluate(`(async () => {
    const img = new Image()
    img.src = 'data:image/png;base64,${data}'
    await img.decode()
    const c = document.createElement('canvas')
    c.width = ${box.w}; c.height = ${box.h}
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(img, ${box.x}, ${box.y}, ${box.w}, ${box.h}, 0, 0, ${box.w}, ${box.h})
    const px = x.getImageData(0, 0, ${box.w}, ${box.h}).data

    const buckets = new Map()
    for (let i = 0; i < px.length; i += 4) {
      const k = (px[i] >> 3) + ',' + (px[i + 1] >> 3) + ',' + (px[i + 2] >> 3)
      const b = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
      b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2]
      buckets.set(k, b)
    }
    let top = null
    for (const b of buckets.values()) if (!top || b.n > top.n) top = b
    const bg = [top.r / top.n, top.g / top.n, top.b / top.n]

    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const [hi, lo] = [lum(${JSON.stringify(box.fg)}), lum(bg)].sort((p, q) => q - p)
    return { ratio: (hi + 0.05) / (lo + 0.05), bg: bg.map(Math.round) }
  })()`)
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1180, height: 800 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
]

for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width, height: vp.height, deviceScaleFactor: 1,
    mobile: vp.name === 'phone',
  })
  await send('Page.navigate', { url: `${BASE}/` })
  await wait(2200)

  console.log(`\n  ${vp.name}  ${vp.width}×${vp.height}`)
  const fails = await evaluate(LAYOUT)
  if (!fails.length) pass('layout, images, alt text, links, fonts')
  fails.forEach(fail)

  if (vp.name !== 'desktop') continue

  let worst = null
  for (const [sel, min] of TARGETS) {
    const r = await contrastOf(sel)
    if (!r || r.missing) { fail(`missing element: ${sel}`); continue }
    if (!worst || r.ratio < worst.ratio) worst = { sel, ...r }
    if (r.ratio < min) {
      fail(`${sel} contrast ${r.ratio.toFixed(2)}:1, needs ${min} (on rgb(${r.bg.join(' ')}))`)
    }
  }
  if (worst) pass(`contrast, tightest is ${worst.sel} at ${worst.ratio.toFixed(2)}:1`)
  await evaluate(`scrollTo({ top: 0, behavior: 'instant' })`)
}

// Every sprite is drawn facing left (eye on the left, tail on the right), so a
// fish whose transform drifts rightward must be mirrored (scaleX < 0) and one
// drifting leftward must not. Sampled from the live matrix, not the keyframes:
// three samples so one wrap-around jump can't fake a direction.
console.log('\n  fish swim head-first')
const backwards = await evaluate(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const read = () => [...document.querySelectorAll('.fish')].map((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return { a: m.a, x: m.e }
  })
  const t0 = read(); await wait(400)
  const t1 = read(); await wait(400)
  const t2 = read()
  return t0.map((s, i) => {
    const deltas = [t1[i].x - s.x, t2[i].x - t1[i].x]
      .filter((d) => Math.abs(d) > 0.5 && Math.abs(d) < innerWidth / 2)
    if (!deltas.length) return 'fish ' + i + ' never moved'
    const right = deltas[0] > 0
    const mirrored = s.a < 0
    if (right !== mirrored) {
      return 'fish ' + i + ' swims ' + (right ? 'right' : 'left') + ' tail-first'
    }
    return null
  }).filter(Boolean)
})()`)
if (!backwards.length) pass('every fish moves the way it faces')
backwards.forEach(fail)

// Reduced motion has to actually stop the animation, not merely declare it.
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
})
await send('Page.navigate', { url: `${BASE}/` })
await wait(1500)
console.log('\n  reduced motion')
const still = await evaluate(`(() => {
  const bad = []
  for (const sel of ['.snow', '.fish', '.rise']) {
    const el = document.querySelector(sel)
    if (!el) continue
    const s = getComputedStyle(el)
    if (s.animationName !== 'none') bad.push(sel + ' still animates: ' + s.animationName)
  }
  const r = document.querySelector('.rise')
  if (r && getComputedStyle(r).opacity !== '1') bad.push('.rise stays hidden')
  return bad
})()`)
if (!still.length) pass('animation stopped, content visible')
still.forEach(fail)

// With scripting off nothing may be left invisible.
await send('Emulation.setEmulatedMedia', { features: [] })
await send('Emulation.setScriptExecutionDisabled', { value: true })
await send('Page.navigate', { url: `${BASE}/` })
await wait(1200)
console.log('\n  no javascript')
const dark = await evaluate(`0`).catch(() => null)
const hidden = await send('Runtime.evaluate', {
  expression: `[...document.querySelectorAll('main *')]
    .filter((e) => getComputedStyle(e).opacity === '0').length`,
  returnByValue: true,
}).then((r) => r.result.value).catch(() => 0)
await send('Emulation.setScriptExecutionDisabled', { value: false })
if (hidden === 0) pass('every section is visible without scripting')
else fail(`${hidden} element(s) invisible with scripting disabled`)

ws.close()
chrome.kill()
server.close()

console.log(bad ? `\n  ${bad} problem(s)\n` : '\n  all clear\n')
process.exit(bad ? 1 : 0)
