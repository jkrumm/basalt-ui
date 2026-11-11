---
name: markdown
use-when: render model or author text with code, diagrams and headings, on an article page
file: apps/playground/src/routes/gallery.tsx
---

`Markdown` takes `contentTrust` (required): `untrusted` for anything a model wrote, `trusted` only for text the app authors.
Code fences render as `CodeBlock`, highlighted by shiki once the block is settled; `mermaid` fences become diagrams.
`fenceRenderers` adds a language: return `undefined` to decline, `null` to render nothing; a throw leaves the code on screen.
`Callout`, `Toc` and `ArticleLayout` come from `basalt-ui/page` and need none of the markdown peers.

```tsx
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
      <Callout kind="info" title="Trust">
        Author text may be `trusted`; text from a model never is.
      </Callout>
      <Markdown contentTrust="untrusted">{reply}</Markdown>
      <CodeBlock lang="bash" code="bun add basalt-ui react-markdown remark-gfm" />
    </ArticleLayout>
  )
}
```
