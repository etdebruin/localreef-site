# localreef.site

The marketing site for [Local Reef](https://github.com/etdebruin/localreef), a
desktop for the apps you build on your own machine.

Three files and a folder of images. No framework, no build step, no install to
run it, which is the same bet the product makes about apps.

```
npm start          # serve at http://localhost:8901
npm run shot       # photograph every section into .shots/
npm run check      # assert the rendered page, at four viewport widths
```

`npm run shot` drives a headless Chrome over the DevTools protocol and captures
one frame per section. Look at the output before claiming a change works. It has
already earned its keep: the first pass showed a hard horizontal seam where a
scrim rectangle ended, and pill backgrounds leaking onto a list of port numbers
from a global `li code` rule.

```
node scripts/shot.mjs hero contribute      # named states only
W=414 H=896 SCALE=2 npm run shot           # at phone size
```

`npm run check` measures the result rather than the source: horizontal overflow,
whether anything clips the wide content, alt text, dead links, whether the chosen
fonts are the fonts in use, reduced motion, and the page with scripting disabled.
It also measures **contrast against the pixels actually painted behind the text**,
by screenshotting and sampling. That detour is not decoration. The obvious version
reads `getComputedStyle(el).color` and the ancestors' `background-color`, and it is
useless here: the colours are `oklch()`, so a naive rgb parse reads
`0.815 0.023 205` as near-black and reports every element failing at 1.25:1, while
the real background is a gradient with no `background-color` to read at all. The
working version found four genuine failures that eyeballing had missed.

## Files

| | |
|---|---|
| `index.html` | the page, including the fish and the gateway diagram as inline SVG |
| `styles.css` | tokens first, then one block per section |
| `main.js` | progressive enhancement only: reveals, the depth gauge, copy to clipboard |
| `assets/` | screenshots and the wallpaper, all lifted from the product itself |

Nothing here is generated. Editing `index.html` and reloading is the whole
workflow.

## Design

`DESIGN.md` holds the art direction and the reasoning: why the page is a water
column, why the backdrop is pushed so far back, which fonts and why. Read it
before making something look different.

## Deploying

Live at <https://localreef-site.vercel.app>. Static hosting, nothing to
configure. The Vercel project belongs to the `everydev` team, whose slug collides
with the personal account name, so the scope has to be the team id:

```
vercel --prod --scope team_5P1gL4XzJ3E7iCidCwdxfBIo
```

**`og:image` and `og:url` are absolute**, because several scrapers reject a
relative path. They point at the `.vercel.app` alias, so both need updating when
a real domain lands.

## Licence

[MIT](./LICENSE). The reef wallpaper and app icon come from the Local Reef repo
and carry the same licence.
