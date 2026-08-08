# Design

Why the site looks the way it does. Read this before changing how something
looks, because a few of these choices exist only because the obvious version was
tried first and did not work.

---

## The organising idea

**The page is a water column.** You start in sunlit shallows and end on the
floor. That descent is one continuous gradient on `<body>` rather than a
background per section, so nothing has a seam and no section has to invent its
own atmosphere. The depth gauge on the right reads it back to you in metres.

It is not decoration. The descent gives the page a spine: the pitch is in
daylight, the architecture is in mid water, and the request for contributors is
at the bottom, where someone who scrolled that far has already committed.

## The register

The lane is a **naturalist specimen plate, submerged**. Numbered plates, hairline
leader rules, captions in mono set like a museum label. It was chosen against two
alternatives, both of them reflexes:

- *Dark SaaS with a gradient hero.* The first thing anyone builds for a developer
  tool, and unfindable in a crowd of them.
- *Editorial-typographic.* Display serif, italic, ruled columns. It is the
  fashionable escape hatch from the first one, which makes it the second reflex
  rather than an answer.

The plate lane is a real fit rather than a swerve: the product is unusually
pretty for a developer tool, and its own documentation reads like field notes.
The site inherits that voice instead of inventing one.

## Colour

**Drenched.** Water carries the whole surface; there is no neutral page anywhere.
The palette is sampled off the product rather than picked fresh, so the site and
the app are the same object:

| Role | | Where it comes from |
|---|---|---|
| Water | `--sunlit` → `--abyss` | the wallpaper gradients in `src/core/backgrounds.js` |
| Coral | `--coral` | the butterflyfish body in `assets/icon.svg` |
| Marigold | `--marigold` | the fins, and the resolved app names |
| Sea glass | `--seaglass` | code and inline identifiers |

Coral is the only colour allowed to mean "act on this". It is the primary
button, the plate numbers, and the outward arrows, and it is nowhere else.

## Scrims are local

Borrowed wholesale from the product, and the one rule that keeps the page
legible over a painting: **darkening the whole scene so one line of small text is
readable is a bad trade.** Where type needs separation it gets a scrim shaped to
the block it protects, not a blanket over the picture.

Every scrim needs a soft edge. The first version of the hero scrim was a
rectangle with a hard bottom, and it drew a visible horizontal line across the
page at the exact height the rectangle ended, which is the failure a scrim exists
to prevent. It carries a mask now.

## The backdrop is pushed a long way back

`assets/reef.webp` is the wallpaper the app ships, and at anything near full
strength it competes with the screenshot beside it, which is also a reef. The
plate stops reading as a screen and the fold turns into two paintings arguing.

So it is blurred 7px, desaturated to 0.42, dimmed to 0.34 opacity, and masked out
before the fold ends. It reads as texture and depth. The screenshot is then the
only sharp, saturated thing above the fold, which is where the attention should
go. The dark ring on `.plate-frame` finishes the job.

## Typography

Three voice words: **submerged, precise, hand-painted.**

| | | |
|---|---|---|
| Display | Bricolage Grotesque | variable width and weight; slightly hand-cut, and it does not look like every other developer tool |
| Body | Golos Text | humanist, warm, holds up as light type on dark |
| Mono | Spline Sans Mono | code, captions, and the gauge |

Mono is load-bearing here rather than costume. There are real shell commands,
real hostnames and a real manifest on the page.

Numbering is Arabic throughout: plates 01 to 06, field notes 01 to 04. It started
as roman numerals, which was wrong for a mechanical reason. `II` in a grotesque at
display size is two vertical bars, and it reads as an ornament rather than a
number.

## Fish

Four species, drawn as SVG symbols and reused: copperband butterflyfish, regal
tang, clownfish, anthias. Each is chosen for a silhouette that survives being
20px wide and half transparent.

**Colour is baked into each symbol rather than inherited.** The first pass drew
them in `currentColor` at low opacity and tinted them per instance, and every one
of them rendered as a brown smudge. A fish needs its markings to read as a fish.

## Motion

One rule: a staggered reveal per group on entry, and slow drift for the fish and
the particulate. Nothing bounces, nothing animates a layout property, and
`prefers-reduced-motion` stops all of it, leaving the fish visible but still.

The page works with JavaScript off. Reveal classes are added by `main.js` rather
than sitting in the markup, so nothing starts out hidden and stays that way if
the script never runs.

## What is deliberately absent

- **No cards.** The gateway notes are ruled columns, the contributor list is
  ruled rows, and the links at the end are an index. A four-up card grid was
  built first and thrown away for being a shape rather than a decision.
- **No glass, except where the product uses it.** The nav scrim and the copy
  button quote the app's own bubble chrome. Nothing else gets a blur.
- **No badge row, no logo wall, no metrics.** The project has none of those
  honestly, and the honesty is the pitch.
