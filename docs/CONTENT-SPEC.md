# Content Spec — the `./content` surface

> Status: IMPLEMENTED (2026-07-16, all three stages) — `packages/basalt-ui/src/content/` ships the
> full surface below; playground demos at `/content` + `/content-overview`.
> **Amendment (2026-07-16):** the article model (`Article<C, T>`, `sortArticles`, `filterArticles`,
> `formatArticleDate`), `ArticleFilterBar`, and `toArticleActions` (a Spotlight projector) shipped —
> see §2 decision 7, §3, and §9 below for the doctrine record. `ArticleCard`/`ArticleLayout` moved
> from a preformatted `meta` string to structured fields (`date`/`category`/`tags`/`readingTime`,
> `date` as ISO 8601). Not a breaking change: `./content` is new in 1.0 and 1.0 is still being built
> on this branch, so there is no published surface carrying the old props — these commits are `feat:`,
> not `feat!:` (the branch's one legitimate `feat!:` is the Tailwind→Mantine pivot itself, which
> breaks against the published v0.4.2).
> Ground truth for typography doctrine remains `docs/DESIGN-SPEC.md` §3; this spec extends it to
> long-form reading surfaces. Research basis: July 2026 ecosystem survey (streamdown v2/remend,
> shiki 4.x, content-collections 0.15, mermaid 11.16/beautiful-mermaid, Fumadocs/Starlight/
> Mintlify/Stripe/Vercel docs UX patterns). Resolved versions: shiki 4.3, remend 1.3,
> react-markdown 10.1, content-collections 0.15, beautiful-mermaid 1.1.

## 1. What this is

basalt-ui renders data today (charts, tables, KPI cards) and conversation (agent-chat). The third
surface is **content**: documentation, guides, articles, AI-streamed prose. One module makes all
three sources render identically, batteries included:

| Source | Entry | Use case |
|-|-|-|
| React children | `<Prose>` | hand-authored JSX articles |
| Markdown string | `<Markdown>` | CMS content, files, **AI-streamed output** (`streaming` prop) |
| MDX | `mdxComponents` map | content-collections / any MDX runtime |

Everything routes through the same primitives (typography CSS, `CodeBlock`, `Callout`,
`MermaidDiagram`), so an AI-streamed answer, a `.md` file, and an MDX guide are visually
indistinguishable and all obey the `--vx-*` token system in both color schemes.

## 2. Design decisions (the load-bearing ones)

1. **One new subpath `./content`, Mantine-coupled.** Content pages live in Mantine apps; no reason
   to force the charts/tokens-style boundary. The prose CSS itself stays plain-CSS-module so the
   inner renderers carry no Mantine imports where avoidable, but the surface is coupled
   (ScrollArea, Drawer, SimpleGrid, ActionIcon).
2. **Recompose streamdown, don't depend on it.** streamdown v2 is Tailwind + shadcn-token locked.
   Its ingredients are standalone and permissively licensed; we use them directly:
   - `react-markdown` 10.1 + `remark-gfm` 4 (already optional peers) — the renderer.
   - `remend` 1.3 (Apache-2.0, zero-dep, ~24 KB) — repairs incomplete streaming markdown
     (unclosed `**`, fences, `[link](...` sentinels). **Bundled exact-pinned dep** (same precedent
     as `motion`): it is an implementation detail, tiny, and needed for the flagship streaming
     path to work out of the box.
   - `marked` lexer block-split + per-block `React.memo` — the AI SDK memoization pattern; only
     the in-flight last block re-renders per token. `marked` is already in the tree transitively?
     No — **avoid the extra dep**: block-split on blank-line boundaries with a small own lexer
     (fence-aware, ~40 lines). Same effect, zero dep.
   - URL hardening — `urlTransform` allowlist (`allowedLinkPrefixes` / `allowedImagePrefixes` /
     `defaultOrigin`) implemented in our own component props; `rehype-harden` not needed as a dep.
3. **Shiki (v4) via dual TextMate themes + `colorReplacements`, `defaultColor: false`.** The
   css-variables theme was evaluated and rejected: ~11 scopes, visibly flat highlighting (shiki's
   own docs warn against it). Dual themes bake BOTH palettes into the output as CSS vars
   (`--shiki-light`/`--shiki-dark` per token; `defaultColor: false` emits vars only), so a Mantine
   scheme flip is pure CSS with zero re-highlighting — token-system-compatible AND full-granularity.
   Default pair `github-light`/`github-dark` with `colorReplacements` mapping both backgrounds
   onto the basalt code surface (block chrome stays `--vx-*`-owned); theme pair overridable.
   Shiki is an **optional peer** (heavy); `CodeBlock` lazy-loads a singleton
   `createHighlighterCore` (`shiki/core`) with `createJavaScriptRegexEngine({ forgiving: true })`
   (streamed/partial code never throws) and on-demand `loadLanguage` from a curated lang map,
   falling back to plain mono `<pre>` when shiki is absent (exactly the `streaming-markdown.tsx`
   optional-peer pattern). Activation CSS keys on `html[data-mantine-color-scheme='light']`.
4. **Diagrams via `beautiful-mermaid`** (MIT, Craft Docs, elkjs-only, sync render, themes are a
   `bg/fg/accent/line/muted/surface/border` token object → emits SVGs referencing CSS custom
   properties, so scheme switching is free). Optional peer. Covers flowchart/state/sequence/
   class/ER/XY. Full-grammar `mermaid` stays a consumer escape hatch (documented, not shipped).
   Streaming-safe: a ```` ```mermaid ```` fence renders as a plain code block until the fence
   closes; render keyed on content hash; parse errors keep the last good SVG.
5. **Article typography gets two new ladder steps.** Chat density (15px/1.55) is wrong for
   long-form reading; research consensus and every serious docs property is 16px body with
   1.65–1.75 leading and a 65–72ch measure. The ladder gains `h2: 21` and `h1: 26` (nothing
   between 18 and 24 exists today, and `kpi` is a numeral step, not a heading step). `Prose`
   ships two densities:
   - `density="article"` (default): body `--vx-text-lg` (16), line-height 1.7, measure 72ch,
     h1 26 / h2 21 / h3 18 / h4 16, generous block spacing.
   - `density="chat"`: byte-compatible with today's `streaming-markdown.module.css` (15/1.55).
6. **TOC is IntersectionObserver scroll-spy, headings self-register.** Heading ids come from our
   own slugger (github-slugger algorithm, ~30 lines, no dep) applied in the `components` map (so
   it works for markdown AND MDX AND JSX headings via `Prose`'s heading components). No
   rehype-slug dep.
7. **content-collections is a recipe, not a dependency.** Build-time tooling belongs to the
   consumer (`@content-collections/core` 0.15 + `/vite` 0.3 + `/mdx` 0.2 as devDeps, Standard
   Schema). We ship: the `mdxComponents` map that makes `<MDXContent components={mdxComponents}>`
   land on basalt primitives, docs in the rule file, and a playground/docs demo. The TanStack
   Start wiring (vite plugin order, tsconfig path alias) is documented in
   `agent/rules/basalt-content.md`.

   **Amendment:** the frontmatter SHAPE now ships as a real type — `Article<C, T>` (generic over
   consumer-declared categories/tags) plus the `sortArticles`/`filterArticles`/`formatArticleDate`
   operators in `article-model.ts`. The originally planned `defineArticleSchema`-style "plain
   Standard Schema object the consumer spreads" is RETIRED — it was never built, it contradicted
   the shipped `basalt-content.md` (which documents a plain zod schema for the content-collections
   recipe, not a basalt-owned Standard Schema seam), and as specified it would have been a config
   bag, which the canonical `defineX` factory contract (`packages/basalt-ui/CLAUDE.md`) forbids.
   Runtime re-validation of frontmatter that content-collections already validated at build time
   buys nothing, so no Standard Schema seam ships for content. `StandardSchemaV1` in `register.ts`
   stays what it always was — a forms/state validation seam, unrelated to content.
8. **Contextual help is a first-class component.** The pattern the user cares about — "this chart
   has a guide" — ships as `GuideLink` (an unobtrusive trigger) + `GuideDrawer` (a right-side
   Drawer rendering any article via `<Markdown>`/`<MDXContent>` at chat density, with an "open
   full page" escape hatch). App surfaces link into content without navigation loss; GitLab
   Pajamas pattern, Stripe-dashboard style.

## 3. Public surface (`basalt-ui/content`)

```
Prose                 typography wrapper; density='article'|'chat'; the one CSS module
Markdown              react-markdown over Prose; props: children(string), streaming?, components?,
                      allowedLinkPrefixes?, allowedImagePrefixes?, defaultOrigin?, remark/rehype?
CodeBlock             shiki (optional peer, lazy singleton, css-variables theme), copy button,
                      title/filename tab, language badge, line numbers?, plain-mono fallback
Callout               kind='info'|'good'|'warn'|'bad' (semantic tokens); markdown GFM alerts
                      (> [!NOTE] etc.) map onto it automatically
MermaidDiagram        beautiful-mermaid (optional peer), --vx-* themed, streaming-safe
TableOfContents       scroll-spy rail; items auto-collected from the article container
ReadingProgress       opt-in 2px top bar (aria-hidden), scroll-driven
ArticleLayout         content + sticky TOC rail + optional breadcrumbs/meta header
                      (title, description, date, readingTime) + PrevNext footer; responsive
ArticleCard/Grid      overview/index pages (docs landing) — StatCard-family aesthetics
Article<C, T>         the article data model, generic over consumer-declared categories/tags
sortArticles          pure sort ('date-desc' | 'date-asc' | 'title'); missing dates sort last
filterArticles        pure filter — category exact-match, tags ANY-OF, AND between axes
formatArticleDate     Intl.DateTimeFormat wrapper — locale + timeZone both pinned (hydration-safe)
ArticleFilterBar      fully controlled category/tags filter UI over the router-tanstack stores
toArticleActions      pure in-memory projector into Spotlight actions (same tier as toRouteActions)
GuideLink/GuideDrawer contextual help: in-app docs drawer
mdxComponents         the element map for MDX runtimes / content-collections MDXContent
headingSlug, readingTime   small utils (own, no deps)
```

Root barrel does NOT re-export `./content` (same policy as charts/tokens: opt-in subpath).

## 4. Dependency policy

| Package | Role | Policy |
|-|-|-|
| `react-markdown` ^10.1, `remark-gfm` ^4 | markdown rendering | already optional peers — unchanged |
| `remend` (exact pin) | streaming repair | new bundled dep (tiny, zero-dep, Apache-2.0) |
| `shiki` ^4.3 | syntax highlighting | new optional peer, lazy-loaded, plain-mono fallback |
| `beautiful-mermaid` ^1 | diagrams | new optional peer, lazy-loaded, code-fence fallback |
| `@content-collections/*`, `@mdx-js/*` | build-time content | consumer devDeps — recipe only, never imported by the package |

Everything degrades: no shiki → plain mono code; no beautiful-mermaid → fenced code display; no
react-markdown → plain text (existing pattern).

## 5. Token additions

- `--vx-text-h1: 26px`, `--vx-text-h2: 21px` ladder steps (+ `VX.text.h1/h2`).
- `--vx-prose-measure: 72ch`.
- No `--vx-code-*` color axis — shiki dual themes carry token colors (see decision 3); the code
  block *surface* (bg, border, header) stays on existing `--vx-*` tokens.
- `--vx-space-sticky-header-clearance` (desktop, `>= sm`) / `--vx-space-sticky-header-clearance-mobile`
  (mobile, `< sm`) — Prose's heading `scroll-margin-top` and ArticleLayout's TOC-rail sticky `top`.
  **Coupled to `BasaltShell` on purpose**: both values are sized to clear `BasaltShell`'s own
  AppShell header at its own breakpoint (`shell/index.tsx`'s `header={{ height: { base, sm } }}`),
  not a generic "some header" number — see `deriveSpacing`'s JSDoc (`tokens/palette.ts`) for the
  exact law. A consumer using `./content` **standalone**, without `BasaltShell` (or with a
  differently-sized header of its own), gets clearance numbers tuned for a header it doesn't have;
  override `--vx-space-sticky-header-clearance`/`-mobile` directly in that case.

## 6. Streaming architecture (the `streaming` prop)

```
raw stream text
  └─ blockSplit(text)         own fence-aware blank-line lexer → string[]
       └─ blocks[0..n-2]      settled → referentially stable → React.memo skips re-render
       └─ blocks[n-1]         in-flight → remend(block) repairs unclosed tokens → rendered live
```

- `streamdown:incomplete-link` sentinel (remend output) → link component renders text without href.
- Hardening always on for `streaming`: links/images filtered by `allowedLinkPrefixes` /
  `allowedImagePrefixes` (default: relative + https same-origin via `defaultOrigin`).
- Code fences highlight per-block on settle (not per token); the in-flight fence renders plain
  mono until closed, then upgrades — no flicker, no wasted highlight passes.
- Mermaid fences render as code until closed; then hash-keyed diagram render.
- `StreamingMarkdown` is deleted; `agent-chat/thread-message.tsx` renders chat text via
  `Markdown streaming density="chat"` — the package's only markdown renderer.

## 7. Docs framing patterns (from the UX survey)

- **TOC**: right rail, sticky, h2/h3, IntersectionObserver active state, auto-collapse to a
  popover under the content-width breakpoint (Fumadocs tableOfContentPopover pattern). Mono
  micro-label header ("ON THIS PAGE") per the DESIGN-SPEC micro-label idiom.
- **Reading progress**: opt-in thin bar, top of the content column, `aria-hidden`.
- **Anchor links**: heading hover reveals `#` link; click copies URL (Starlight pattern).
- **Prev/Next**: footer pagination cells with directional arrows, title + optional section.
- **Overview**: `ArticleGrid` of `ArticleCard`s (icon/title/description/date/category/tags/
  readingTime — structured fields, not a preformatted `meta` string) — the established
  docs-landing card grid, styled like the dashboard composites (panel bg, 7px radius, hairline).
  `sortArticles`/`filterArticles` compose above the grid; `ArticleFilterBar` renders the
  category/tags controls.
- **Breadcrumbs**: reuse `AppBreadcrumbs`/`useRouterBreadcrumbs` — already shipped.
- **Search**: articles project into the existing command system via `toArticleActions`/Spotlight
  (same tier as `toRouteActions`); recipe in the rule file (content-collections gives the typed
  article list to map over).
- **Code UX**: copy button always; filename/title tab; language badge; horizontal scroll (X-axis
  scroll is the sanctioned exception per `raw-scroll-container`); optional line highlighting later.

## 8. Integration & doctrine artifacts (ship with the module)

- `package.json` exports `./content` + optional peers (`shiki`, `beautiful-mermaid`).
- `src/surfaces.ts` SURFACES entry (drives gen-oxlint/gen-llms; `check-coverage` asserts it).
- `agent/rules/basalt-content.md` — the consumer rule file: when to use which entry, the
  content-collections + TanStack Start recipe (vite plugin order, tsconfig alias, MDXContent +
  mdxComponents), the streaming contract, the guide-drawer pattern, escape hatches.
- Playground: `/content` demo page — article with TOC + reading progress + code + diagram +
  callouts; a streaming simulation section; an overview-grid section; a GuideLink on an existing
  chart page.
- llms.txt regeneration; pack-test covers the new subpath.

## 9. Non-goals (1.0 of the module)

- KaTeX/math (add later as `@streamdown/math`-style optional peer if needed).
- Full mermaid grammar bundling, d2 (59 MB WASM), pintora (stale) — escape hatches only.
- Vega-Lite streamed chart specs — revisit only with a real consumer need; visx stays the chart
  system.
- Versioned docs, i18n routing — consumer concerns.
- A search *index* or indexing service (Pagefind, Algolia, server-side search) — consumer concern. The framework ships `toArticleActions`, a pure in-memory **projector** into the already-shipped Spotlight command surface (the same tier as `toRouteActions`); it does not tokenize, rank, index, or persist. An app that outgrows substring matching over a client-side array brings its own index.
- A taxonomy vocabulary. The framework ships `Article<C, T>` generic over categories/tags and the operators over them; *which* categories and tags exist is domain data, declared consumer-side — the `VX.series` doctrine applied to content.
- Grouping/pagination UI. Sorting and filtering ship. Grouped section rendering and pagination await a real consumer need.
- A list/grid view toggle. Six cards fit one screen and a list re-renders identical content narrower — it is a control that exists to look configurable.
- A `create-basalt-docs` scaffold — deferred with the rest of the create-* family.
