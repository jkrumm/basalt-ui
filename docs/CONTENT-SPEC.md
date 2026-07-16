# Content Spec — the `./content` surface

> Status: IMPLEMENTED (2026-07-16, all three stages) — `packages/basalt-ui/src/content/` ships the
> full surface below; playground demos at `/content` + `/content-overview`.
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
   land on basalt primitives, a `defineArticleSchema`-style zod-free frontmatter shape (plain
   Standard Schema object the consumer spreads), docs in the rule file, and a playground/docs
   demo. The TanStack Start wiring (vite plugin order, tsconfig path alias) is documented in
   `agent/rules/basalt-content.md`.
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
- `agent-chat`'s `StreamingMarkdown` remains; `Markdown streaming density="chat"` is its
  successor surface — migration note in the rule file, no breaking change now.

## 7. Docs framing patterns (from the UX survey)

- **TOC**: right rail, sticky, h2/h3, IntersectionObserver active state, auto-collapse to a
  popover under the content-width breakpoint (Fumadocs tableOfContentPopover pattern). Mono
  micro-label header ("ON THIS PAGE") per the DESIGN-SPEC micro-label idiom.
- **Reading progress**: opt-in thin bar, top of the content column, `aria-hidden`.
- **Anchor links**: heading hover reveals `#` link; click copies URL (Starlight pattern).
- **Prev/Next**: footer pagination cells with directional arrows, title + optional section.
- **Overview**: `ArticleGrid` of `ArticleCard`s (icon/title/description/meta) — the established
  docs-landing card grid, styled like the dashboard composites (panel bg, 7px radius, hairline).
- **Breadcrumbs**: reuse `AppBreadcrumbs`/`useRouterBreadcrumbs` — already shipped.
- **Search**: articles project into the existing command system via `toRouteActions`/Spotlight;
  recipe in the rule file (content-collections gives the typed article list to map over).
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
- Versioned docs, i18n routing, search indexing service — consumer concerns.
- A `create-basalt-docs` scaffold — deferred with the rest of the create-* family.
