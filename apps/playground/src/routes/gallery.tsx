import { Stack } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { ChartsSection } from '../demo/gallery/charts'
import { ComponentsSection } from '../demo/gallery/components'
import { DataSection } from '../demo/gallery/data'
import { FormsSection } from '../demo/gallery/forms'
import { useV3Tokens } from '../demo/v3-tokens'
import { validateShotSearch } from '../scenarios/shot-state'
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
      <Callout kind="info" title="Trust">
        Author text may be `trusted`; text from a model never is.
      </Callout>
      <Markdown contentTrust="untrusted">{reply}</Markdown>
      <CodeBlock lang="bash" code="bun add basalt-ui react-markdown remark-gfm" />
    </ArticleLayout>
  )
}
// #endregion

function GalleryRoute() {
  useV3Tokens()
  const shotState = Route.useSearch()['shot-state']
  return (
    <Stack gap="xl">
      <ComponentsSection shotState={shotState} />
      <FormsSection />
      <MarkdownRegion />
      <ChartsSection />
      <DataSection shotState={shotState} />
    </Stack>
  )
}

export const Route = createFileRoute('/gallery')({
  staticData: { title: 'Gallery' },
  validateSearch: validateShotSearch,
  component: GalleryRoute,
})
