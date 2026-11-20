# A content site on Astro 7: the `site` profile

An Astro page renders a React component with no `client:` directive to HTML at build time and sends
nothing else. `basalt-ui/static` holds parts made for that: no provider, no context, no hook, no
router, every word a prop. The same parts render unchanged in a TanStack Start or Vite app.
`basalt-ui/astro` wires them into Astro in one line.

## Set it up

These are the commands run against basalt-ui.com (`apps/marketing`) and a fresh Astro 7 project.

```sh
bun add basalt-ui @astrojs/react react react-dom tailwindcss @tailwindcss/vite
bunx basalt-ui init --profile site
```

```js
// astro.config.mjs
import react from '@astrojs/react'
import { basaltAstro } from 'basalt-ui/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({ integrations: [react(), basaltAstro()] })
```

```astro
---
// src/layouts/Layout.astro
import BasaltFonts from 'basalt-ui/astro/BasaltFonts.astro'
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <BasaltFonts />
  </head>
  <body><slot /></body>
</html>
```

`basaltAstro()` does four things in `astro:config:setup`: it adds `@tailwindcss/vite` (never add it to
`vite.plugins` as well), injects `basalt-ui/static.css` on every page, registers the three faces with
the Astro Fonts API (Fontsource), and inlines `themeScript()` then the parts' own listeners in every head.
`<BasaltFonts />` emits the faces and preloads the body face only. `basaltAstro({ fonts: false })` leaves
fonts to the site, which then sets `--basalt-font-sans`, `--basalt-font-head` and `--basalt-font-mono`.
Your own files are found by Tailwind's automatic source detection; the parts' sources come with
`static.css`. A page whose islands use other basalt subpaths adds their `@source` lines in its own sheet.

## The parts

| Part                        | What it is                                                                                                  | Interactive through           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `Prose`                     | the article typography; styles raw Markdown and MDX output by element                                       | nothing                       |
| `SiteArticle`               | title block, body, a table of contents and an optional docs nav                                             | `<details>` below 64rem       |
| `SitePager`                 | previous and next links                                                                                     | nothing                       |
| `SiteCallout`               | a tinted note with a tone                                                                                   | nothing                       |
| `SiteCodeBlock`             | wraps your toolchain's `<pre>` with a copy button                                                           | the integration's head script |
| `SiteHeader`                | brand, links, actions; a menu below the `wide` size                                                         | the `popover` attribute       |
| `SiteFooter`                | brand, link columns, fine print                                                                             | nothing                       |
| `ThemeSwitch`               | light, dark, system                                                                                         | the integration's head script |
| `siteMdxComponents(labels)` | the MDX map: anchored headings, safe links, scrolling tables, code blocks, `SiteCallout`, `Steps`, `Figure` | the head script, for copy     |

### Landing blocks

| Block                      | What it is                                                                                        | Interactive through     |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- |
| `SiteHero`                 | `h1`, eyebrow, standfirst, actions; a `media` slot beside the text from 64rem                     | nothing                 |
| `SiteBento`, `SiteFeature` | a grid of tiles, one to three columns by its container; a tile's body is a slot for the real part | nothing                 |
| `SiteComparison`           | a versus table: options as columns, traits as rows, a `footnote` slot for the dated sources       | nothing                 |
| `SiteQuestionList`         | questions as data, rendered as `<details>`                                                        | the `<details>` element |
| `SiteCallToAction`         | the closing band: heading, line, actions                                                          | nothing                 |

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
    acceptedAnswer: { '@type': 'Answer', text: q.answer },
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
   --browser`) to these budgets, measured on its build:

| Number                                                              | Measured | Budget           |
| ------------------------------------------------------------------- | -------- | ---------------- |
| module JavaScript on a page with no island                          | 0 B      | 0 B              |
| basalt's head scripts (scheme + parts), gzip                        | 735 B    | 2 kB (unit test) |
| inline JavaScript on any page, Astro's island loader included, gzip | 2.6 kB   | 3 kB             |
| the React runtime the first island brings, gzip                     | 69.8 kB  | 72 kB            |
| a further island's own chunk (the chart island), gzip               | 117 kB   | 120 kB           |
| CSS per page, gzip                                                  | 26.1 kB  | 26.5 kB          |
| LCP, landing, article and docs page, 390 px, local                  | 72 ms    | 1,000 ms         |
| CLS, the same three pages                                           | 0        | 0.02             |

## Starlight

Docs on Starlight take basalt's look from one bridge sheet and share basalt's scheme store:

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

## In TanStack Start or Vite

The parts are the same imports and render anywhere, server components included: import
`basalt-ui/static.css` from your sheet and put `themeScript()` in the head. The menu needs no
script. `ThemeSwitch` and the copy button need the parts' listeners, which ship only through
`basalt-ui/astro` today: outside Astro they render but do nothing until a host needs the listeners
exported.
