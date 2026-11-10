import { Box, Button, Group, Stack } from '@mantine/core'
import { Section, StatCard } from 'basalt-ui'
import { ArticleLayout, Callout, GuideLink, Markdown } from 'basalt-ui/content'
import { useEffect, useRef, useState } from 'react'

const fence = (info: string, code: string) => `\`\`\`${info}\n${code}\n\`\`\``

const VITE_CONFIG_SNIPPET = `import { defineConfig } from 'vite'
import { basaltViteConfig } from 'basalt-ui/vite'

export default defineConfig({ ...basaltViteConfig() })`

// GFM table, WARNING alert, titled fence, a `javascript:` link (rendered neutralized) and an
// off-origin image (dropped): the hardening shown visually.
const PIPELINE_MARKDOWN = `| Stage | Latency |
| --- | --- |
| Ingest | 40ms |
| Serve | 8ms |

> [!WARNING]
> The transform stage falls behind under sustained load.

${fence('ts title="query.ts"', 'export const loadStage = (name: string) => db.query(name)')}

See the [runbook](/docs/runbook) or a [bad link](javascript:alert(1)).

![Untrusted image](https://evil.example.com/tracker.png)
`

const DIAGRAM_MARKDOWN = fence(
  'mermaid',
  'flowchart LR\n  A[Ingest] --> B{Healthy?}\n  B -->|yes| C[Serve]\n  B -->|no| D[Alert]',
)

// A bold word streams in unclosed, the ts fence renders plain in flight, and the mermaid fence
// upgrades to a diagram once the trailing paragraph settles it.
const STREAM_FIXTURE = `The renderer repairs **unclosed formatting** as each chunk arrives.

${fence('ts', 'export const retry = (n: number) => n - 1')}

${fence('mermaid', 'flowchart LR\n  A[Chunk] --> B[Settle] --> C[Render]')}

The stream finished cleanly.
`

const GUIDE_MARKDOWN = `## How this metric is measured

The 95th-percentile latency is the value below which 95% of requests complete.

> [!NOTE]
> A breach for five sustained minutes pages on-call.
`

function StreamingDemo() {
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
      cursor += 8
      setText(STREAM_FIXTURE.slice(0, cursor))
      if (cursor >= STREAM_FIXTURE.length) stopStream()
    }, 40)
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

export function ContentSection() {
  return (
    <Stack gap="md">
      <Section title="Contextual guides" subtitle="GuideLink opens a GuideDrawer in place.">
        <Group gap="md" align="flex-start" wrap="wrap">
          <Box w={220}>
            <StatCard
              title="P95 Latency"
              value="312ms"
              delta={-4.2}
              deltaPeriod="last week"
              actions={<GuideLink title="How p95 latency is measured" markdown={GUIDE_MARKDOWN} />}
            />
          </Box>
          <Box w={220}>
            <StatCard
              title="Error budget"
              value="42%"
              actions={
                <GuideLink title="How error budget is tracked" markdown={GUIDE_MARKDOWN} iconOnly />
              }
            />
          </Box>
        </Group>
      </Section>

      <Section
        title="Article"
        subtitle="ArticleLayout with a TOC rail, Markdown fences and Callouts."
      >
        <ArticleLayout
          meta={{
            title: 'Reading dashboards',
            description: 'A dashboard earns attention by answering one question in five seconds.',
            date: 'Jul 16, 2026',
            readingTime: 6,
          }}
          readingProgress
        >
          <h2 id="why-ignored">Why dashboards get ignored</h2>
          <p>
            The failure mode is rarely &ldquo;no data.&rdquo; It&rsquo;s too much data, with no
            hierarchy between the number that changes the plan and the merely interesting one.
          </p>
          <h3 id="baselines">Missing baselines</h3>
          <p>
            Every headline metric needs a delta against a stated period; see the{' '}
            <a href="#playbook">playbook</a>.
          </p>
          <blockquote>
            <p>If a viewer has to ask &ldquo;compared to what?&rdquo;, the chart has failed.</p>
          </blockquote>
          <Markdown>{fence('ts title="vite.config.ts"', VITE_CONFIG_SNIPPET)}</Markdown>
          <h2 id="playbook">Operational playbook</h2>
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
            </tbody>
          </table>
          <Callout kind="info" title="Auto-collected">
            <p>The TOC rail collects every heading with an id.</p>
          </Callout>
          <Callout kind="good" title="Healthy">
            <p>Health score has held above 75 for seven days.</p>
          </Callout>
          <Callout kind="warn" title="Watch">
            <p>Error budget is 40% consumed with two weeks left.</p>
          </Callout>
          <Callout kind="bad" title="At risk">
            <p>p95 latency breached the threshold three times in the last hour.</p>
          </Callout>
        </ArticleLayout>
      </Section>

      <Section title="Markdown pipeline" subtitle="Hardened document, mermaid diagram, streaming.">
        <Stack gap="md">
          <Markdown allowedImagePrefixes={['/']}>{PIPELINE_MARKDOWN}</Markdown>
          <Markdown>{DIAGRAM_MARKDOWN}</Markdown>
          <StreamingDemo />
        </Stack>
      </Section>
    </Stack>
  )
}
