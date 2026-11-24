# A content site on Astro 7: the `site` profile

An Astro page renders a React component with no `client:` directive to HTML at build time and sends
nothing else. `basalt-ui/static` holds parts made for that: no provider, no context, no hook, no
router, every word a prop. The same parts render unchanged in a TanStack Start or Vite app.
`basalt-ui/astro` wires them into Astro in one line.

## Set it up

These are the commands run against basalt-ui.com (`apps/marketing`) and a fresh Astro 7 project.

```sh
bun add basalt-ui @astrojs/react react react-dom tailwindcss @tailwindcss/vite
./node_modules/.bin/basalt-ui init --profile site
```

`init` wires a stock project with no hand edit: it puts `basaltAstro()` after `react()` in
`astro.config.*` (adding `react()` to a config that has no integrations yet), writes
`src/layouts/Layout.astro` when the site has none (`<BasaltFonts />`, `lang`, `dir`, a title and a
description), ignores `.basalt/sources.css`, and places the site's agent set: the `basalt-tokens` and
`basalt-site` rules and the `basalt-site` skill. A config it cannot read as stock is printed as a
to-do; `doctor` fails until `basaltAstro()` follows `react()`.

```js
// astro.config.mjs, as init leaves it
import react from '@astrojs/react'
import { basaltAstro } from 'basalt-ui/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({ integrations: [react(), basaltAstro()] })
```

`basaltAstro()` does five things in `astro:config:setup`: it adds `@tailwindcss/vite` (never add it to
`vite.plugins` as well), writes `.basalt/sources.css` and injects it on every page, registers the three
faces with the Astro Fonts API (Fontsource), and inlines `themeScript()` then the parts' own listeners in
every head. At `astro:build:done` it runs the island check (below).

The sheet is `basalt-ui/static.css`, then the token sheets `.basalt/manifest.json` records, then the
`@source` lines of everything the site's own imports reach (`basalt-ui/charts`, `basalt-ui/ui/dialog`, the MDX
tags): the closure `basalt()` computes for a Vite app, so a dialog island brings the button it draws, with an
`@source not` line for each primitive nothing reaches (never `alert` or `table`, which `static.css` sources). The paths resolve from the installed package, so a hoisted workspace install works the same and no
`@source` line is written by hand. It is rewritten on every build and dev start; a new import is picked up
on the next one. `basaltAstro({ sources: false })` injects `basalt-ui/static.css` instead, for a site that
lists its own sources.

`<BasaltFonts />` emits the faces and preloads the body face only. The faces load the `latin` and
`latin-ext` subsets; `basaltAstro({ fonts: { subsets: ['latin', 'cyrillic'] } })` names others, and
`fonts: false` leaves fonts to the site, which then sets `--basalt-font-sans`, `--basalt-font-head` and
`--basalt-font-mono`. Your own files are found by Tailwind's automatic source detection.

## Islands: the check

`ASTRO_PARTS` from `basalt-ui/astro` is the part table the Astro matrix measures: for each part, its
`interaction` with no JavaScript (`none`, `enhance` or `required`) and its best render mode. A
`required` part (a dialog, sheet, menu, popover, select, combobox, picker) renders dead without an island,
so `basaltAstro()` fails the build when its markup sits outside an `<astro-island>`:

```text
basalt-ui: 1 part(s) that need JavaScript render outside an island, so they would ship dead:
  Dialog (data-slot="dialog-trigger") on /about/index.html
Fix: render the part inside a React component of your own (src/islands/<Name>.tsx) and place that
with a client directive, <Name client:visible /> (client:idle above the fold, client:load for a first tap).
```

A part is found by the `data-slot` it renders on the server. A closed `Tooltip` renders none, so the check
cannot see one placed without an island. `doctor` reads the same table: a `site` root may import every `ui`
part in it, for its islands.

## The parts

| Part | What it is | Interactive through |
|-|-|-|
| `Prose` | the article typography; styles raw Markdown and MDX output by element | nothing |
| `SiteArticle` | title block, body, a table of contents and an optional docs nav | `<details>` below 64rem |
| `SitePager` | previous and next links | nothing |
| `SiteCallout` | a tinted note with a tone | nothing |
| `SiteCodeBlock` | wraps your toolchain's `<pre>` with a copy button | the integration's head script |
| `SiteHeader` | brand, links and menus (panels of link rows and tiles), actions; a full-height sheet below the `wide` size | the `popover` attribute and `interestfor`; the head script adds hover where `interestfor` is missing and the arrow keys |
| `SiteFooter` | brand, link columns, fine print | nothing |
| `ThemeSwitch` | light, dark, system | the integration's head script |
| `SiteTabs`, `SiteTab` | tabs as platform markup; panels named by `label` | the integration's head script |
| `SiteForm`, `SiteField`, `SiteSubmit` | a native form that posts to `action` | the browser: `required`, `type`, `:user-invalid` |
| `SiteDataTable` | a table of plain columns and rows, numbers and dates formatted | nothing |
| `siteMdxComponents(labels)` | the MDX map: anchored headings, safe links, scrolling tables, code blocks, `SiteCallout`, `Steps`, `Figure`, `Tabs`, `Tab`, `Form`, `Field`, `SubmitButton` | the head script, for copy and tabs |

### Landing blocks

| Block | What it is | Interactive through |
|-|-|-|
| `SiteHero` | `h1`, eyebrow, standfirst, actions; a `media` slot beside the text from 64rem | nothing |
| `SiteBento`, `SiteFeature` | a grid of tiles, one to three columns by its container; a tile's body is a slot for the real part | nothing |
| `SiteComparison` | a versus table: options as columns, traits as rows, a `footnote` slot for the dated sources | nothing |
| `SiteQuestionList` | questions as data, rendered as `<details>` | the `<details>` element |
| `SiteCallToAction` | the closing band: heading, line, actions | nothing |

Actions are data, `{ href, label, primary? }`, at most one `primary` in a row. A slot takes an island
too: an island inside a static block's slot hydrates on its own. basalt emits no structured data; the
question list's array is the source for your own:

```astro
---
const questions = [{ question: 'Is it free?', answer: 'Yes, and open source.' }]
const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: questions.map((q) => ({
    '@type': 'Question',
    name: q.question,
    acceptedAnswer: { '@type': 'Answer', text: [q.answer].flat().join('\n\n') },
  })),
}
---
<SiteQuestionList title="Questions" questions={questions} />
<script type="application/ld+json" set:html={JSON.stringify(faq)} />
```

Pass a node to a part as a named slot (`<Fragment slot="meta">…</Fragment>`), never as JSX inside an
object prop: Astro hands that over as an Astro template and the build fails. Labels are plain strings.

## Performance contract

1. **Static by default.** Every `basalt-ui/static` part renders with no directive. A test calls each
   one outside a React render, where any hook throws, and checks its markup carries no script.
2. **The hydration ladder** for your own islands, one rule each:
   - `client:visible` for an island below the fold;
   - `client:idle` for one above the fold that the reader does not need at once;
   - `client:load` only for one that must answer the first tap;
   - `client:only="react"` only for a part that measures its box, such as a chart, with a fallback
     of the same height so nothing shifts.
3. **One `BasaltProvider` per island**, never around the page: islands run isolated from each other,
   so a context cannot span two. Parts that share state live in one island.
4. **Fonts** through the Astro Fonts API from the integration; only the body face is preloaded.
5. **View transitions**: the browser's native cross-document transitions (`@view-transition`) add no
   JavaScript and are the default. `<ClientRouter />` ships a router, turns on prefetch for every
   link and needs scripts re-initialised after each navigation: a cost to choose, not a default.
6. **Prefetch** is the site's call. basalt never turns it on. Starlight does, for every page; set
   `prefetch: false` in `astro.config` to keep pages without islands at zero JavaScript.
7. **Measured, not claimed.** basalt-ui.com is held in CI (`apps/marketing/scripts/measure.ts --check
   --browser`) to these budgets; `bun run measure` in `apps/marketing` prints the numbers behind them. A
   test holds the budget column to `site-budgets.json`.

<!-- site-budgets:begin -->

| Number | Budget |
|-|-|
| module JavaScript on a page with no island | 0 B |
| basalt's head scripts (scheme + parts), gzip | 2,048 B (unit test) |
| inline JavaScript on any page, Astro's island loader included, gzip | 3,750 B |
| the React runtime the first island brings, gzip | 72,000 B |
| a further island's cost (the chart island on `/charts`), gzip | 129,250 B |
| the two MDX islands together (`/guides/islands-in-mdx`), gzip | 340,250 B |
| CSS per page, gzip | 40,750 B |
| LCP, landing, article and docs page, 390 px, local | 1,000 ms |
| CLS, the same three pages | 0.05 |

<!-- site-budgets:end -->

## Interactive parts in MDX

An MDX page asks for more than headings and code: tabs, a table of figures, a chart, a form. Four tags
cover them, each with one hydration rule. The tags that need no React are in `siteMdxComponents(labels)`;
the two that do are `.astro` files, because Astro puts a `client:` directive only on a component written
in a template, never on one an MDX `components` map names.

```astro
---
import { siteMdxComponents } from 'basalt-ui/static'
import Chart from 'basalt-ui/astro/mdx/Chart.astro'
import DataTable from 'basalt-ui/astro/mdx/DataTable.astro'
import { Content } from '../guides/post.mdx'
const components = { ...siteMdxComponents(labels), Chart, DataTable }
---
<Content components={components} />
```

```mdx
<Tabs label="Install with" tabs={['bun', 'npm']}>
  <Tab label="bun">`bun add basalt-ui`</Tab>
  <Tab label="npm">`npm i basalt-ui`</Tab>
</Tabs>

<DataTable label="Releases" columns={[{ key: 'v', label: 'Version' }]} rows={[{ v: '3.0' }]} />
<DataTable interactive label="Runs" columns={cols} rows={rows} />
<Chart title="Deploys" x="week" series={[{ key: 'deploys', label: 'Deploys' }]} data={weeks} />
```

<!-- mdx-island-cost:begin -->

| Tag | Picture | Island | Directive | Matrix part | Further cost, gzip, at most |
|-|-|-|-|-|-|
| `Tabs`, `Tab` | ARIA tab list and panels | none | none | none | 0.4 kB inline, in the head script |
| `Form`, `Field`, `SubmitButton` | a native form | none | none | none | 0 |
| `DataTable` | a static table | none | none | none | 0 |
| `DataTable interactive` | the same table | sortable, pageable `DataTable` | `client:visible` (`load="idle"` above the fold) | `data-table` | 267.4 kB |
| `Chart` | a fallback box of the card's height | `ChartCard` over `Lines` or `Bars` | `client:only="react"` (`load="visible"` or `"idle"` once its server picture is right) | `chart-card` | 133.5 kB |

<!-- mdx-island-cost:end -->

The first island on a page also brings React, react-dom and Astro's island runtime (71.5 kB), once, however
many islands follow. The cost column is the part's further-island budget in `docs/v3/verdicts/astro-matrix.md`, a
ceiling every CI build is held to, and a test holds the two together.

- **Names are data.** A `Tab` is told apart from its siblings by its `label`, which names one entry of the
  `tabs` list, because an MDX compiler hands a part its children as finished HTML. Without the head
  script every panel shows under its name and the tab row is hidden.
- **Columns, rows and series are plain data** (strings, numbers, dates): a function cannot cross an island
  boundary. A chart with custom marks, zones or linked readouts is your own island in `src/islands/`.
- **A chart's server picture is right only at the width the server assumes** (640 px, a card less its
  edges) and differs on a phone (3% to 18% of the pixels at 390 px, `docs/v3/verdicts/astro-matrix.md`),
  which is why the default is `client:only`. A table's does not differ: `interactive` server-renders it,
  then hydrates.
- **No provider.** Neither island needs `BasaltProvider`; an island you write that does wraps its own.
- **Classes.** The two islands use chart and table classes; importing a tag adds its directories to
  `.basalt/sources.css`.
- **Words.** Both tags take `locale` (numbers and dates) and `messages`, the string entries of the
  message catalog (`IslandMessages` from `basalt-ui/astro`): a function entry cannot cross into an island.

## Starlight

Starlight is the docs engine: a docs site (sidebar, search, versioned pages) is Starlight themed through
the bridge sheet, and `SiteArticle` is for guides and articles. basalt ships the bridge and nothing past it:
no Starlight plugin and no component of its own for Starlight. Docs on Starlight take basalt's look from
that sheet and share basalt's scheme store:

```js
starlight({
  customCss: ['basalt-ui/starlight.css'],
  expressiveCode: {
    useStarlightDarkModeSwitch: false,
    useDarkModeMediaQuery: true,
    themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
  },
  components: { Head, ThemeProvider, ThemeSelect }, // see apps/marketing/src/components/starlight
})
```

The `ThemeProvider` override drops the `data-theme` Starlight renders on the server and runs
`themeScript()`; the `ThemeSelect` override renders `ThemeSwitch` with Starlight's own translated labels.

On a site that also renders MDX through `siteMdxComponents`, add `mdx()` from `@astrojs/mdx` after
`starlight()`. Without it Starlight registers `mdx({ optimize: true })`, which compiles plain elements to
HTML strings, so the heading, link, table and code block overrides never run. Placed before
`starlight()`, it breaks Starlight's code blocks, which must register ahead of MDX.

## Direction

Right-to-left is supported for the static parts: they and `prose.css` use logical properties throughout,
chevrons mirror with `rtl:`, the tab and menu arrow keys follow the computed direction, and the site lint
preset fails a physical property (`basalt/logical-properties`). Set `dir="rtl"` on `<html>` in the layout.
Named gaps: the charts draw left to right, and the app parts behind an island are not checked in RTL.

## In TanStack Start or Vite

The parts are the same imports and render anywhere, server components included: import
`basalt-ui/static.css` from your sheet, then put `themeScript()` and `siteScript()` from `basalt-ui/static`,
with the same scheme options, in an inline script in the head. The menu needs no script; `ThemeSwitch`,
the copy button and the tabs need `siteScript()`.
