/* ───────────────────────────────────────────────────────────────────
   Progressive enhancement only. With JavaScript off the page is fully
   readable: reveal classes are added here rather than in the markup, so
   nothing starts out hidden.
   ─────────────────────────────────────────────────────────────────── */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── nav gains a scrim once it leaves the hero ──────────────────── */

const nav = document.querySelector('.nav')
const onScrollNav = () => nav.classList.toggle('stuck', scrollY > 40)
onScrollNav()

/* ── reveal on entry ───────────────────────────────────────────────
   Staggered within a group so a row of items arrives as a sequence
   rather than all at once. */

const groups = [
  ['.hero-copy > *', 70],
  ['.hero-plate', 0],
  ['.problem .two > *', 90],
  ['.apps .section-head', 0],
  ['.specimen', 0],
  ['.how .section-head, .how .section-lede', 60],
  ['.diagram-plate', 0],
  ['.grid-notes > div', 90],
  ['.how .plate:last-of-type', 0],
  ['.notes .section-head, .notes .section-lede', 60],
  ['.entries li', 80],
  ['.pull', 0],
  ['.contribute .section-head, .contribute .section-lede', 60],
  ['.start > *', 90],
  ['.want-head', 0],
  ['.wants li', 55],
  ['.ways li', 45],
]

if (!reduced && 'IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('in')
      seen.unobserve(e.target)
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 })

  for (const [sel, step] of groups) {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('rise')
      if (step) el.style.transitionDelay = `${i * step}ms`
      seen.observe(el)
    })
  }
}

/* ── ports resolve into names ──────────────────────────────────────
   The list is legible either way; lighting it is emphasis, not
   information, so it degrades to the plain state without JS. */

const resolve = document.querySelector('.resolve')
if (resolve && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    resolve.classList.add('lit')
    io.disconnect()
  }, { threshold: 0.4 })
  io.observe(resolve)
}

/* ── depth gauge ───────────────────────────────────────────────────
   Reads scroll position as metres, and marks the section you are in.
   Both are one rAF-throttled pass over the same numbers. */

const gaugeEl = document.querySelector('.gauge')
const readout = document.getElementById('depth')
const ticks = [...document.querySelectorAll('.gauge a')]
const FLOOR = 240

const sections = ticks
  .map((a) => ({ tick: a, el: document.querySelector(a.getAttribute('href')) }))
  .filter((s) => s.el)

function gauge() {
  const span = document.documentElement.scrollHeight - innerHeight
  const p = span > 0 ? Math.min(1, Math.max(0, scrollY / span)) : 0
  if (readout) readout.textContent = Math.round(p * FLOOR)
  if (gaugeEl) gaugeEl.classList.toggle('show', scrollY > innerHeight * 0.7)

  // The section whose top has most recently passed a third of the fold.
  const line = scrollY + innerHeight / 3
  let active = 0
  sections.forEach((s, i) => {
    if (s.el.getBoundingClientRect().top + scrollY <= line) active = i
  })
  sections.forEach((s, i) => s.tick.classList.toggle('on', i === active))
}

let queued = false
function onScroll() {
  onScrollNav()
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    gauge()
  })
}

addEventListener('scroll', onScroll, { passive: true })
addEventListener('resize', onScroll, { passive: true })
gauge()

/* ── copy the clone line ───────────────────────────────────────── */

document.querySelectorAll('[data-copy]').forEach((btn) => {
  const label = btn.querySelector('.copy-state')
  const idle = label ? label.textContent : ''
  let timer

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy)
      if (!label) return
      btn.classList.add('done')
      label.textContent = 'copied'
    } catch {
      if (!label) return
      label.textContent = 'press ⌘C'
    }
    clearTimeout(timer)
    timer = setTimeout(() => {
      btn.classList.remove('done')
      if (label) label.textContent = idle
    }, 2000)
  })
})
