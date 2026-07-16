/**
 * Content demo — the full `basalt-ui/content` surface (docs/CONTENT-SPEC.md). A real technical
 * article ("Reading dashboards") framed by `ArticleLayout` (meta header, sticky TOC rail, opt-in
 * reading progress, a "Content overview" next link) — exercising `CodeBlock` (a titled TypeScript
 * snippet + an untitled bash snippet), `Callout` (all four kinds), a GFM-style table, a
 * blockquote, and links, with headings self-registering into the rail via `headingSlug`.
 *
 * The "Markdown pipeline" section exercises the streaming layer: a rendered `Markdown` document
 * (GFM table, a `[!WARNING]` alert, a titled code fence, hardened links/images), a settled mermaid
 * diagram, and a replayable streaming simulation (unclosed-bold repair, in-flight code, a mermaid
 * fence upgrading from plain code to a diagram once it settles).
 */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { ArticleLayout, Callout, CodeBlock, headingSlug, Markdown } from 'basalt-ui/content'

const VITE_CONFIG_SNIPPET = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { basaltViteConfig } from 'basalt-ui/vite'

export default defineConfig({
  ...basaltViteConfig(),
  plugins: [react()],
})`

const INSTALL_SNIPPET = `bun add basalt-ui
bun run dev`

const PLAYBOOK_ID = headingSlug('Operational playbook')
const MARKDOWN_PIPELINE_ID = headingSlug('Markdown pipeline')

// Exercises GFM tables, a WARNING alert, a titled ts fence, inline code, a same-origin relative
// link, an external https link, a `javascript:` link (must render neutralized), and an image on a
// disallowed origin (must be dropped) — rendered with the same-origin-only image allowlist the
// streaming mode defaults to, proving the hardening visually.
const PIPELINE_MARKDOWN = `| Stage | Latency | Notes |
| --- | --- | --- |
| Ingest | 40ms | Kafka consumer group |
| Transform | 120ms | Streaming aggregation |
| Serve | 8ms | Read replica |

> [!WARNING]
> The transform stage falls behind under sustained load above 5k events/sec.

\`\`\`ts title="query.ts"
export function loadStage(name: string) {
  return db.query('select * from stage where name = $1', [name])
}
\`\`\`

Inline code like \`db.query\` reads from a hot replica. See the [runbook](/docs/runbook) for the
on-call steps, or the [source](https://github.com/jkrumm/basalt-ui) repo. A stray
[bad link](javascript:alert(1)) should render as plain, unlinked text.

![Untrusted image](https://evil.example.com/tracker.png)
`

const PIPELINE_DIAGRAM_MARKDOWN = `\`\`\`mermaid
flowchart LR
  A[Ingest] --> B[Transform]
  B --> C{Healthy?}
  C -->|yes| D[Serve]
  C -->|no| E[Alert on-call]
\`\`\`
`

// Streamed a few characters at a time — a bold word streams in unclosed for several chunks before
// the closing \`**\` arrives, the ts fence renders as plain code while in flight, and the mermaid
// fence upgrades from a plain code block to a real diagram once the trailing paragraph after it
// pushes it out of the "last block" position.
const STREAM_FIXTURE = `## Streaming demo

The renderer repairs **unclosed formatting** as each chunk arrives — this word was **bold**
before the closing marker had even streamed in yet.

\`\`\`ts
export function retry(fn: () => Promise<void>, attempts = 3): Promise<void> {
  return fn().catch((err) => {
    if (attempts <= 1) throw err
    return retry(fn, attempts - 1)
  })
}
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Chunk arrives] --> B[remend repairs the tail]
  B --> C[Block settles]
  C --> D[Mermaid renders]
\`\`\`

Once the diagram above settles, this closing line proves the stream finished cleanly.
`

const STREAM_CHUNK_SIZE = 8
const STREAM_INTERVAL_MS = 40

function StreamingMarkdownDemo() {
  const [text, setText] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopStream = () => {
    if (timerRef.current === null) return
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  const replay = () => {
    stopStream()
    setText('')
    let cursor = 0
    timerRef.current = setInterval(() => {
      cursor += STREAM_CHUNK_SIZE
      setText(STREAM_FIXTURE.slice(0, cursor))
      if (cursor >= STREAM_FIXTURE.length) stopStream()
    }, STREAM_INTERVAL_MS)
  }

  useEffect(() => stopStream, [])

  return (
    <>
      <Button onClick={replay} variant="default" size="xs">
        Replay stream
      </Button>
      <Markdown streaming>{text}</Markdown>
    </>
  )
}

export function ContentDemoPage() {
  return (
    <ArticleLayout
      meta={{
        title: 'Reading dashboards',
        description:
          'A dashboard earns attention by answering one question in under five seconds: is ' +
          'anything wrong, and if so, where? Most internal dashboards fail that test — not ' +
          'because the underlying data is bad, but because the presentation buries the one ' +
          'signal that matters under a wall of charts nobody asked for.',
        date: 'Jul 16, 2026',
        readingTime: 6,
      }}
      readingProgress
      next={{ label: 'Content overview', href: '/content-overview' }}
      renderLink={(target, node) => <Link to={target.href as never}>{node}</Link>}
    >
      <h2 id={headingSlug('Why dashboards get ignored')}>Why dashboards get ignored</h2>
      <p>
        The failure mode is rarely &ldquo;no data.&rdquo; It&rsquo;s too much data, with no
        hierarchy between the number that changes the plan and the number that&rsquo;s merely
        interesting.
      </p>

      <h3 id={headingSlug('Alert fatigue')}>Alert fatigue</h3>
      <p>
        A team that pages on every threshold breach stops trusting pages. The same logic applies to
        dashboards — a page with twenty equally-weighted KPI cards trains the eye to skim past all
        of them.
      </p>

      <h3 id={headingSlug('Missing baselines')}>Missing baselines</h3>
      <p>
        A raw value (&ldquo;1,204 sessions&rdquo;) tells you nothing without a comparison. Every
        headline metric needs a delta against a stated period — WoW, MoM, or a fixed baseline — or
        the viewer has to hold last week&rsquo;s number in their head.
      </p>

      <h2 id={headingSlug('Designing for the five-second glance')}>
        Designing for the five-second glance
      </h2>
      <p>
        Lead with the delta, not the absolute. A card reading <code>+12.4%</code> next to a muted{' '}
        <code>vs last week</code> label carries the whole story; the raw count is secondary context,
        not the headline.
      </p>

      <blockquote>
        <p>If a viewer has to ask &ldquo;compared to what?&rdquo;, the chart has already failed.</p>
      </blockquote>

      <h2 id={headingSlug('Instrumenting the pipeline')}>Instrumenting the pipeline</h2>
      <p>
        Getting a dashboard on screen is the easy part — see the{' '}
        <a href={`#${PLAYBOOK_ID}`}>operational playbook</a> below for the thresholds that actually
        page someone.
      </p>

      <CodeBlock code={INSTALL_SNIPPET} language="bash" />

      <p>Wire the shared token layer into the build so charts and chrome read one palette:</p>

      <CodeBlock title="vite.config.ts" language="ts" code={VITE_CONFIG_SNIPPET} />

      <h2 id={PLAYBOOK_ID}>Operational playbook</h2>
      <p>Three signals, three thresholds, three responses — nothing on this list is optional:</p>

      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>Threshold</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>p95 latency</td>
            <td>&gt;400ms for 5m</td>
            <td>Page on-call</td>
          </tr>
          <tr>
            <td>Error rate</td>
            <td>&gt;1% for 10m</td>
            <td>Auto-rollback</td>
          </tr>
          <tr>
            <td>Queue depth</td>
            <td>&gt;5,000 messages</td>
            <td>Scale consumers</td>
          </tr>
        </tbody>
      </table>

      <Callout kind="info" title="Auto-collected">
        <p>
          This page&rsquo;s <code>TableOfContents</code> auto-collects every heading above with an{' '}
          <code>id</code> — nothing on the rail is a hand-maintained list.
        </p>
      </Callout>

      <Callout kind="good" title="Healthy">
        <p>Health score has held above 75 for seven consecutive days — no action needed.</p>
      </Callout>

      <Callout kind="warn" title="Watch">
        <p>Error budget is 40% consumed with two weeks left in the cycle.</p>
      </Callout>

      <Callout kind="bad" title="At risk">
        <p>p95 latency breached the 400ms threshold three times in the last hour.</p>
      </Callout>

      <h2 id={MARKDOWN_PIPELINE_ID}>Markdown pipeline</h2>
      <p>
        The streaming layer of <code>basalt-ui/content</code>: a streaming-aware{' '}
        <code>Markdown</code> renderer, <code>MermaidDiagram</code>, and the MDX component map. The
        three demos below all route through the same primitives as the hand-authored article above.
      </p>

      <h3 id={headingSlug('A rendered markdown document')}>A rendered markdown document</h3>
      <p>
        GFM tables, a GFM alert, a titled code fence, inline code, and hardened links/images — the
        stray <code>javascript:</code> link and the off-origin image are both neutralized.
      </p>
      <Markdown allowedImagePrefixes={['/']}>{PIPELINE_MARKDOWN}</Markdown>

      <h3 id={headingSlug('A mermaid diagram')}>A mermaid diagram</h3>
      <p>
        A settled <code>mermaid</code> fence renders as a real diagram, themed off the{' '}
        <code>--vx-*</code> token layer.
      </p>
      <Markdown>{PIPELINE_DIAGRAM_MARKDOWN}</Markdown>

      <h3 id={headingSlug('A streaming simulation')}>A streaming simulation</h3>
      <p>
        Replay a simulated AI stream — watch the bold word repair itself, the code fence render
        plain while in flight, and the mermaid fence upgrade to a diagram once it settles.
      </p>
      <StreamingMarkdownDemo />
    </ArticleLayout>
  )
}
