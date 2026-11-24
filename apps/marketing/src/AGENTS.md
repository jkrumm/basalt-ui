# apps/marketing/src: rules for a page

The root `apps/marketing/AGENTS.md` points here. Read this before changing a page, component, island, layout or guide under `src/`.

- Render a basalt part with no `client:` directive. A part that needs one is the `DataTable` or `Chart` tag
  (their directive is the tag's `interactive` and `load` props), or belongs in `src/islands/`:
  `client:visible` below the fold, `client:idle` above it when not urgent, `client:load` only for
  the first tap, `client:only="react"` only for a part that measures its box (a chart), with a
  fallback of the same height.
- One `BasaltProvider` per island, never around the page; parts that share state share an island.
- A node passed to a part is a named slot (`<Fragment slot="meta">`), never JSX inside an object
  prop: Astro hands that over as an Astro template and the build fails.
- Keep every URL: the site is linked from npm, GitHub and search results.
- `prefetch` stays off: Starlight would turn it on and put a module script on every page.

## How it is wired

- `astro.config.mjs`: `integrations: [react(), basaltAstro(), starlight(...)]`. `basaltAstro()` from
  `basalt-ui/astro` adds `@tailwindcss/vite`, injects `basalt-ui/static.css` on every page, registers
  the three faces with the Astro Fonts API and inlines the scheme script and the parts' listeners in the head.
  Never add `tailwindcss()` to `vite.plugins` by hand: the integration adds it once.
- `src/layouts/Layout.astro` is the one layout for non-docs pages: `<BasaltFonts />` in the head,
  `SiteHeader`, `SiteFooter`, `ThemeSwitch`. Links and every visible word live in `src/lib/site.ts`;
  a part takes its words as props, never from basalt.
- `/docs/*` is Starlight (`src/content/docs/docs/`), themed by `basalt-ui/starlight.css` in
  `customCss`. `src/components/starlight/` overrides `Head` (fonts), `ThemeProvider` (basalt's scheme
  script) and `ThemeSelect` (basalt's `ThemeSwitch`), so docs and site share one stored scheme.
- `/guides/*` are MDX files under `src/guides/` rendered in `SiteArticle` with
  `siteMdxComponents(...)` as their components; raw Markdown is styled by element through
  `.basalt-prose`, and `<SiteCallout>`, `<Steps>` and `<Figure>` need no import.
- `/` is built from the landing blocks (`SiteHero`, `SiteBento`, `SiteComparison`, `SiteQuestionList`,
  `SiteCallToAction`); its words and data live in `src/lib/landing.ts`. `src/components/` holds React
  compositions of basalt parts that render with no directive (the hero's stat cards).
- `/charts` holds the site's one hand-written island (`src/islands/`). `src/styles/site.css` adds the
  `@source` lines for the chart, card and table classes the islands use.
- MDX pages take `Tabs`, `Tab`, `Form`, `Field` and `SubmitButton` from `siteMdxComponents(...)`, which render
  with no JavaScript; `DataTable` and `Chart` are the package's `basalt-ui/astro/mdx/*.astro` tags, added to
  `components` by the page. `/guides/interactive-content` is held at zero module JavaScript (it is not in
  `SCRIPTED`); `/guides/islands-in-mdx` carries the two islands.
- A fence in a guide is highlighted by Starlight's expressive-code, whose copy-button module script
  `plugins/guide-static-code.mjs` removes from `src/guides/` pages (the site's `SiteCodeBlock` button stays);
  the docs keep it. The integration must follow `starlight()` in `integrations`.
