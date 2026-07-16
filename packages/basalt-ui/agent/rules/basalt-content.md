---
source: basalt-ui
description: Content/prose surface from basalt-ui/content — Prose, CodeBlock, Callout, TableOfContents, ReadingProgress, Markdown (streaming-aware), MermaidDiagram, MDX component map, ArticleLayout, ArticleCard/Grid, GuideLink/GuideDrawer, and the content-collections + TanStack Start recipe. Mantine-coupled (docs/CONTENT-SPEC.md).
paths:
  - 'src/content/**'
  - 'apps/**/src/**/*content*'
---

# Basalt Content — Prose, Markdown, Mermaid, MDX, Docs Framing

basalt-ui ships `./content` — a Mantine-coupled surface for long-form reading (docs, guides,
hand-authored articles, AI-streamed prose) plus the docs-framing chrome around it: a page layout,
overview cards, and a contextual-help drawer.

## Prose vs Markdown vs MDX

| Entry                                     | Input              | Use case                                                               |
| ----------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `<Prose>`                                 | React children     | hand-authored JSX articles                                             |
| `<Markdown>`                              | a markdown string  | CMS content, files, **AI-streamed output** (`streaming` prop)          |
| `mdxComponents` / `createMdxComponents()` | MDX runtime output | `content-collections`/any MDX pipeline's `MDXContent components={...}` |

All three route through the SAME typography CSS (`Prose`), the same `CodeBlock`/`MermaidDiagram`
fenced-code rendering, and the same GFM-alert-aware `Callout` blockquote mapping — a hand-authored
article, a rendered markdown file, and an MDX guide are visually indistinguishable. `Markdown`
wraps its own `<Prose>` internally; `mdxComponents` does NOT — wrap MDX output in `<Prose>`
yourself, or reach for `ArticleLayout` (below), which wraps it for you.

## Density

`density='article'` (default) — 16px body, 1.7 leading, a 72ch measure (`VX.text.h1`/`h2` + the
`--vx-prose-measure` token), generous block spacing. `density='chat'` — byte-equivalent to
`basalt-ui/agent`'s `StreamingMarkdown` typography (15px/1.55). Use `chat` density only when
composing `Prose` around chat-density content; `StreamingMarkdown` still owns its own container for
the agent surface itself.

**The type-ladder rule applies here too**: never a literal font-size in JSX or a bespoke CSS value
— every size in `Prose`/`CodeBlock`/`Callout`/`ArticleLayout`/`ArticleCard`/`GuideDrawer` resolves
to a `VX.text.*` / `--vx-text-*` step. `h1` (26px) and `h2` (21px) are the two ladder steps this
surface added.

## CodeBlock — optional-peer behavior

`shiki` is an OPTIONAL peer, lazy-loaded via a module-level singleton (`createHighlighterCore`,
dual `github-light`/`github-dark` themes, `defaultColor: false` — a Mantine scheme flip is then
pure CSS, zero re-highlighting). Without `shiki` installed, or for an unrecognized `language`,
`CodeBlock` degrades to a plain mono `<pre>` — never a crash, never an unhandled rejection.

```bash
bun add shiki
```

```tsx
import { CodeBlock } from 'basalt-ui/content'

<CodeBlock title="vite.config.ts" language="ts" code={source} />
<CodeBlock language="bash" code="bun add basalt-ui" />
```

## TableOfContents / ReadingProgress

`TableOfContents` auto-collects `h2`/`h3` ids from a `containerRef` (IntersectionObserver
scroll-spy) or takes an explicit `items` list — pair it with `headingSlug`/`SlugTracker` when
authoring heading ids by hand. `ReadingProgress` is an opt-in scroll-driven top bar, `target`
defaults to the whole document. Both are headless-styled but Mantine-coupled; `ArticleLayout`
already wires both for you (below) — reach for them directly only when composing a custom page
shell.

## Markdown — streaming contract

`<Markdown streaming>` is the flagship AI-stream path: pass the accumulating string on every
token, no debouncing needed.

- **`blockSplit`** (own fence-aware, blank-line lexer — no dep) splits `children` into top-level
  blocks. Every block except the last renders through a `React.memo`'d renderer — referentially
  stable `components`/`urlTransform` (built once per `Markdown` render via `useMemo`) is what makes
  the memo actually skip re-rendering an unchanged settled block.
- The LAST (in-flight) block is repaired via `remend` before rendering — unclosed `**`/`` ` ``/
  `~~`/`$$`, an incomplete `[text](url` link (remend rewrites it to
  `streamdown:incomplete-link` — any `streamdown:` href is dropped by the link hardening below).
- **Hardening is ALWAYS ON**, streaming or not: `allowedLinkPrefixes` (default `['https://',
'mailto:', '#', '/']`) / `allowedImagePrefixes` (default `['https://', '/']`) / `defaultOrigin`
  (resolves a relative URL before the allowlist check's result is used). A disallowed `href`/`src`
  renders as an unlinked `<span>` / a dropped image — never a raw unsafe URL.
- Fenced code highlights/upgrades per BLOCK on settle, not per token — the in-flight fence renders
  plain mono (`CodeBlock showCopy={false}`) until its block settles.
- Heading ids: a document-wide `SlugTracker` in non-streaming mode gives correct cross-heading
  dedup (`overview`, `overview-1`, …). In `streaming` mode each block gets its OWN tracker instead
  (a shared tracker would have to live across memoized blocks that never re-render) — a heading
  text repeated across two DIFFERENT blocks will NOT get a deduped suffix. Streamed chat content
  doesn't drive a `TableOfContents`, so this is an accepted tradeoff, not a bug.
- `StreamingMarkdown` (`basalt-ui/agent`) is unaffected and keeps shipping — `<Markdown
streaming density="chat">` is its successor surface for new code; migrate opportunistically, not
  urgently.

## MermaidDiagram — support matrix

`beautiful-mermaid` (optional peer, lazy dynamic import, module-level singleton) covers exactly
six diagram types: **flowchart, state, sequence, class, ER, XY chart**. Anything else (full
mermaid grammar — gantt, git graphs, mindmaps, …) is a consumer escape hatch: install the full
`mermaid` package yourself and render it outside `Markdown`/`MermaidDiagram`; this module does not
attempt to cover it.

Theming passes `var(--vx-*)` strings straight through as `bg`/`fg`/`line`/`accent`/`muted`/
`surface`/`border` — the emitted SVG references those custom properties directly, so a Mantine
scheme flip never re-renders the diagram. A ` ```mermaid ` fence inside `Markdown`'s `streaming`
mode renders as plain `CodeBlock` while it's the in-flight block and upgrades to `MermaidDiagram`
once the block settles (parse errors keep the last successfully-rendered SVG rather than blanking
a working diagram).

## ArticleLayout — the docs-page frame

The page shell around a `Prose`/`Markdown`/`MDXContent` body: a centered content column, a sticky
scroll-spy TOC rail (`toc`, default `true`, auto-hides below 1200px), an opt-in reading-progress
bar (`readingProgress`, default `false`), a title/description/date/reading-time meta header
(`meta`), and a prev/next pagination footer (`prev`/`next`). The header/content/footer share ONE
grid column, so the article body reads as a single consistent width whether or not the TOC rail is
visible.

```tsx
import { ArticleLayout } from 'basalt-ui/content'
import { Link } from '@tanstack/react-router'
;<ArticleLayout
  meta={{
    title: 'Reading dashboards',
    description: 'Why most internal dashboards fail the five-second glance test.',
    date: 'Jul 16, 2026',
    readingTime: 6,
  }}
  readingProgress
  next={{ label: 'Chart guide', href: '/guides/charts' }}
  renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
>
  <h2 id="setup">Setup</h2>
  <p>…</p>
</ArticleLayout>
```

**The `renderLink` router-bridge convention** — every content component that links (`ArticleLayout`
prev/next, `ArticleCard`, `GuideDrawer`'s "open full page" link) takes an optional `renderLink:
(target, node) => ReactNode` prop. It defaults to a plain `<a href={target.href}>{node}</a>`; pass
a router bridge to get client-side navigation:

```tsx
// TanStack Router
renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
```

## ArticleCard / ArticleGrid — overview pages

The docs-landing card grid (StatCard-family aesthetics: panel bg, shadow-card, card radius, no
explicit `p`/`radius` on the underlying `Card` — the shared inset idiom). `ArticleCard` is
clickable three ways: `href` alone renders the card itself as an anchor; `href` + `renderLink`
hands it to a router bridge; `onClick` alone renders a keyboard-operable button-role card. Omit all
three for a static card.

```tsx
import { ArticleCard, ArticleGrid } from 'basalt-ui/content'
import { Link } from '@tanstack/react-router'
;<ArticleGrid>
  <ArticleCard
    title="Reading dashboards"
    description="Why most internal dashboards fail the five-second glance test."
    meta="6 min read · guide"
    href="/content"
    renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
  />
</ArticleGrid>
```

## GuideLink / GuideDrawer — contextual help

The "this chart has a guide" pattern (GitLab Pajamas / Stripe-dashboard style): `GuideDrawer` is a
controlled right-side `Drawer` rendering an article at article density (`markdown` string via
`Markdown`, or `children` via `Prose`) with an optional "open full page" footer link; `GuideLink`
is the uncontrolled quiet trigger + drawer pair — mount it next to whatever it explains. The
trigger MUST read as quiet (faint ink, accent on hover) — it is never a loud primary button.

```tsx
import { GuideLink } from 'basalt-ui/content'

<GuideLink
  title="How p95 latency is measured"
  markdown={p95GuideMarkdown}
  fullPageHref="/guides/p95-latency"
/>

// Icon-only variant, for a tight chart-card header
<GuideLink title="How this metric works" markdown={guideMarkdown} iconOnly />
```

## content-collections + TanStack Start recipe

Build-time content tooling is a **recipe, not a dependency** — `@content-collections/*` are
consumer devDeps, never a `basalt-ui` dependency. Resolved versions: `@content-collections/core`
`0.15`, `@content-collections/vite` `0.3`, `@content-collections/mdx` `0.2`. Wire the MDX runtime
part (`@content-collections/mdx/react`) as a regular dependency instead of a devDep if the consumer
does strict prod-only installs — it's imported at runtime, not just build time.

**Install:**

```bash
bun add -D @content-collections/core @content-collections/vite @content-collections/mdx
```

**`vite.config.ts`** — the content-collections vite plugin MUST precede every other plugin (it
generates the virtual `content-collections` module other plugins/transforms may depend on).
TanStack Start (`>= 1.121`) wires it the same way:

```ts
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { contentCollections } from '@content-collections/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true }, // makes the `content-collections` tsconfig alias resolve
  plugins: [
    contentCollections(), // FIRST — before tanstackStart()/react()
    tanstackStart(),
    viteReact(), // react's vite plugin must come AFTER start's
  ],
})
```

**`tsconfig.json`** — path alias so `import { allDocs } from 'content-collections'` resolves to the
generated output (picked up by `resolve.tsconfigPaths` above):

```json
{
  "compilerOptions": {
    "paths": {
      "content-collections": ["./.content-collections/generated"]
    }
  }
}
```

**`.gitignore`** — the generated output is build tooling, not source:

```
.content-collections
```

**`content-collections.ts`** — a Standard Schema definition (a plain zod object works directly;
`content: z.string()` is required by the frontmatter parser) plus an MDX `transform` that compiles
the body once at build time:

```ts
import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMDX } from '@content-collections/mdx'
import { z } from 'zod'

const docs = defineCollection({
  name: 'docs',
  directory: 'content/docs',
  include: '**/*.mdx',
  schema: (z) => ({
    title: z.string(),
    description: z.string().optional(),
    date: z.string().optional(),
    content: z.string(),
  }),
  transform: async (doc, ctx) => ({
    ...doc,
    mdx: await compileMDX(ctx, doc),
  }),
})

export default defineConfig({ collections: [docs] })
```

**The page/route** — `MDXContent` from `@content-collections/mdx/react` renders the compiled body
onto `mdxComponents`, wrapped in `ArticleLayout` for the full docs-page frame:

```tsx
import { allDocs } from 'content-collections'
import { MDXContent } from '@content-collections/mdx/react'
import { ArticleLayout } from 'basalt-ui/content'
import { mdxComponents } from 'basalt-ui/content'
import { Link } from '@tanstack/react-router'

const doc = allDocs.find((d) => d.slug === slug)

<ArticleLayout
  meta={{ title: doc.title, description: doc.description, date: doc.date }}
  renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
>
  <MDXContent code={doc.mdx} components={mdxComponents} />
</ArticleLayout>
```

**Wiring articles into Spotlight** — `allDocs` is a typed article list; map it into page actions the
same way the shell's own nav model does, via `toRouteActions` (`basalt-ui/commands`) so every
article is instantly searchable without a separate search index:

```ts
import { allDocs } from 'content-collections'
import { toRouteActions } from 'basalt-ui/commands'

const articleActions = toRouteActions(
  allDocs.map((doc) => ({ key: doc.slug, label: doc.title, href: `/docs/${doc.slug}` })),
  { navigate },
)
```

## Escape hatches / non-goals

KaTeX/math, full mermaid grammar bundling (d2, pintora), Vega-Lite streamed specs, versioned docs/
i18n routing, and a `create-basalt-docs` scaffold are all out of scope for 1.0 — see
`docs/CONTENT-SPEC.md` §9 for the full non-goals list and rationale.
