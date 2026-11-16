// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:markdown
import { CodeBlock, Markdown } from 'basalt-ui/content'
import { ArticleLayout, Callout } from 'basalt-ui/page'

// Model output: `untrusted` shows no images and no raw HTML. `~~~` fences are plain markdown.
const reply = [
  '## Reading the page',
  'A table, a fence and a [guide](/docs/guide). Mermaid fences become diagrams.',
  '| Stage | Latency |\n| - | - |\n| Ingest | 40 ms |\n| Serve | 8 ms |',
  '~~~ts\nexport const load = (name: string) => db.query(name)\n~~~',
  '~~~mermaid\ngraph LR\n  Ingest --> Serve\n~~~',
  '## Next steps',
  'Headings carry anchors; the table of contents follows the page.',
].join('\n\n')

export function MarkdownRegion() {
  return (
    <ArticleLayout
      meta={{ title: 'Markdown and code', description: 'One renderer.', readingTime: 3 }}
      readingProgress
    >
      <Callout tone="info" title="Trust">
        Author text may be `trusted`; text from a model never is.
      </Callout>
      <Markdown contentTrust="untrusted">{reply}</Markdown>
      <CodeBlock lang="bash" code="bun add basalt-ui react-markdown remark-gfm" />
    </ArticleLayout>
  )
}
// #endregion
