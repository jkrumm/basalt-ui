---
name: basalt-site
description: Build a content site on Astro with basalt-ui: set it up with `init --profile site`, pick the page type (landing, guide or article, docs on Starlight), add an island only where a part needs one, and verify a static page ships no script.
when_to_use: User is adding basalt-ui to an Astro site, writing a landing page, guide, article, blog post or docs page, putting a chart, table, dialog or other interactive part on a content page, wiring Starlight, or a site build fails naming a part outside an island.
---

Procedure only. The law is `.claude/rules/basalt-site.md` and `.claude/rules/basalt-tokens.md`; every part and prop is in `node_modules/basalt-ui/docs/astro.md` and `node_modules/basalt-ui/docs/<name>.md`.

## Set up

1. Install from the project root: `bun add basalt-ui astro @astrojs/react react react-dom tailwindcss @tailwindcss/vite` (npm, pnpm and yarn work the same), then run `./node_modules/.bin/basalt-ui init --profile site` from the local bin, never `bunx`.
2. `init` puts `basaltAstro()` after `react()` in a stock `astro.config.*`, writes `src/layouts/Layout.astro` when there is none (the fonts, `lang`, a title slot) and ignores `.basalt/sources.css`. A config it cannot patch is printed as a to-do: make that edit by hand.
3. Run `./node_modules/.bin/basalt-ui doctor` and fix every finding until it is clean, then `astro build`.

## Pick the page type

- **Landing**: `SiteHeader`, `SiteHero`, `SiteBento`, `SiteComparison`, `SiteQuestionList`, `SiteCallToAction`, `SiteFooter`.
- **Guide**: an MDX file in a `guides` collection and one `[...slug].astro`: `SiteArticle`, `SiteNav` as its `nav`, `siteMdxComponents(labels)`, `SitePager` from the collection order.
- **Article, blog post**: a `posts` collection in `SiteArticle`; the list is `SitePostList`. **Changelog**: `SiteChangelog` over release rows.
- **Docs with a sidebar and search**: Starlight through `basalt-ui/starlight.css` (`docs/astro.md`, section Starlight).
- **A table or chart inside MDX**: the tags `basalt-ui/astro/mdx/DataTable.astro` and `Chart.astro`; they choose their directive by `load` and take `locale`.

Keep every label in one file of the site's words (`src/lib/site.ts`) and pass it as props. Pass a node to a part as a named slot (`<Fragment slot="meta">`), never as JSX inside an object prop: the build fails on that.

## Add an island

1. Look up the part's `interaction` in `ASTRO_PARTS` from `basalt-ui/astro` (the same table drives the build check):
   - `none`: render it in the `.astro` page with no directive.
   - `enhance`: the static picture works; add `client:visible` (`client:idle` above the fold) only when the behavior is wanted.
   - `required`: it is dead without JavaScript.
2. A `required` part, or any part with state, goes in an island: the smallest React component holding the state, in `src/islands/<Name>.tsx`, placed as `<Name client:visible />` (the ladder is in the rule).
3. A build that stops with `basalt-ui: N part(s) that need JavaScript render outside an island` lists each part and its page: move the part into an island as above. Never remove the check.

## The head

The layout `init` writes holds `<BasaltFonts />` and `lang`; set `dir="rtl"` there for a right-to-left site. Put `<SiteHead title description />` from `basalt-ui/astro/SiteHead.astro` in the head: it writes the canonical URL (from `site` in `astro.config`), Open Graph, the Twitter card and, with `type="article"`, the article's JSON-LD. Code in fenced blocks follows the scheme through `markdown.shikiConfig: basaltShiki` (`docs/astro.md`, sections Page types and Code colors).

## Verify

1. `astro build` passes; it also runs the island check.
2. A page with no island ships no module script: `grep -c 'type="module"' dist/<page>/index.html` prints 0.
3. `./node_modules/.bin/basalt-ui doctor` is clean and `./node_modules/.bin/basalt-ui lint --changed` finds nothing.
