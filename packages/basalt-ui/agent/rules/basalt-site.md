---
source: basalt-ui
description: Content pages on Astro — static parts, an island only where a part needs one, every word a prop.
paths:
  - '**/src/**'
---

# Basalt Site

A content page is static HTML from `basalt-ui/static`, and JavaScript is an island you chose; each bullet names what holds it.

## Wiring

- One integration wires the site: `integrations: [react(), basaltAstro()]`. Never add `@tailwindcss/vite`, `basalt-ui/static.css` or an `@source` line for a basalt subpath by hand: `basaltAstro()` writes `.basalt/sources.css` from the site's own imports. [type:BasaltAstroOptions]
- `<BasaltFonts />` sits in the layout head. A site with its own faces passes `fonts: false` and sets the three `--basalt-font-*` variables; a script beyond Latin names its `subsets`. [type:BasaltAstroOptions]

## Islands

- A part that needs JavaScript to open (a dialog, sheet, menu, popover, tooltip, select, combobox or picker) renders only inside an island with a `client:*` directive; `basaltAstro()` fails the build naming the part and the page when one sits outside. [build:island-directive]
- A part's `interaction` and best directive are data in `ASTRO_PARTS` from `basalt-ui/astro`: `none` takes no directive, `enhance` works static and gains behavior from one, `required` needs one. [type:AstroPart]

## Words and layout

- Every visible word and accessible name is a prop the page passes from the site's own words; a part never brings its copy, and the MDX parts take theirs through `siteMdxComponents(labels)`. [type:SiteMdxLabels] [type:SiteHeaderProps]
- Key layout on the container (`@narrow:`, `@regular:`, `@wide:`), never on a viewport prefix such as `md:`. [lint:viewport-keyed]
- Write logical properties (`ms-*`, `pe-*`, `start-*`), never physical ones (`ml-*`, `right-*`), so a page with `dir="rtl"` mirrors. [lint:logical-properties]

not guarded:

- A page type is a recipe in the `basalt-site` skill: a landing page from the landing blocks, a guide or article in `SiteArticle`, docs on Starlight through `basalt-ui/starlight.css`.
- The hydration ladder: `client:visible` below the fold, `client:idle` above it, `client:load` only for a first tap, `client:only="react"` only for a part that measures its box, with a fallback of its height.
- One `BasaltProvider` per island, never around a page; parts that share state live in one island.
- Keep `prefetch: false` while a page must ship no module script: Starlight turns prefetch on for every page.
- The layout sets `lang` and `dir` on `<html>` and a title and description per page; canonical and social tags are the site's own.
