/**
 * A static server, so the page can be opened over http rather than file://.
 * The font stylesheet and the module script both need a real origin.
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = Number(process.env.PORT ?? 8901)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
}

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]))
  if (path.includes('..')) { res.writeHead(403).end('no'); return }

  let file = join(ROOT, path === '/' ? 'index.html' : path)
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  }
}).listen(PORT, () => {
  console.log(`  Local Reef site  →  http://localhost:${PORT}`)
})
