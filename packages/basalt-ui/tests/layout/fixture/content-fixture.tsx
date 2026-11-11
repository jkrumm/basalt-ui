/**
 * The `content` fixture (docs/v3/concepts/ai-mdx.md section 7, P8 and P9): the markdown region the
 * playground gallery shows, on its own markup: an `ArticleLayout` holding a `Callout`, a `Markdown`
 * with headings, a wide table, a long code line and a mermaid fence, and a `CodeBlock`. It is the
 * entry the `content` layout test bundles; the harness is told to "mount" it by a no-op
 * `window.basaltMountFixture`.
 *
 * Probes, each carrying a `data-testid`: `content-region` (the layout), `content-long-code` (a
 * CodeBlock with a line far wider than any viewport).
 */
import { createRoot } from 'react-dom/client'
import { Markdown } from '../../../src/content/markdown'
import { CodeBlock } from '../../../src/content/code-block'
import { ArticleLayout } from '../../../src/page/article-layout'
import { Callout } from '../../../src/page/callout'

const LONG_LINE = `export const handler = (request: Request, context: HandlerContext) => respond(request, context, { cache: 'no-store', retries: 3, timeoutMs: 15000 })`

const REPLY = [
  '## Reading the page',
  'A table, a fence and a [guide](/docs/guide). Mermaid fences become diagrams, and a very long unbroken-identifier-that-would-push-the-page-sideways-if-nothing-wrapped-it-at-all-1234567890 wraps.',
  '| Stage | Latency | Owner | Notes |\n| - | - | - | - |\n| Ingest | 40 ms | platform | the first stage reads from the queue |\n| Serve | 8 ms | edge | the last stage writes to the cache |',
  `~~~ts\n${LONG_LINE}\n~~~`,
  '~~~mermaid\ngraph LR\n  Ingest --> Parse --> Enrich --> Serve\n~~~',
  '### A subsection',
  'Text under the subsection.',
  '## Next steps',
  'Headings carry anchors; the table of contents follows the page.',
].join('\n\n')

function Fixture() {
  return (
    <main className="p-4 text-foreground" data-testid="content-region">
      <ArticleLayout
        meta={{ title: 'Markdown and code', description: 'One renderer.', readingTime: 3 }}
        readingProgress
      >
        <Callout kind="info" title="Trust">
          Author text may be trusted; text from a model never is.
        </Callout>
        <Markdown contentTrust="untrusted">{REPLY}</Markdown>
        <div data-testid="content-long-code">
          <CodeBlock lang="ts" code={LONG_LINE} />
        </div>
      </ArticleLayout>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
