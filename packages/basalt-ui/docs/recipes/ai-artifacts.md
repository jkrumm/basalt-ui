---
name: ai-artifacts
use-when: a model produces a document, a block, code or an html preview that opens beside the chat and keeps its versions
file: apps/playground/src/recipes/ai-artifacts.tsx
---

An artifact opens in `PageAside`; each version is a `ui/tabs` tab, the newest opens. The kind picks the renderer: untrusted `Markdown`, `catalog.Block`, `CodeBlock`, or a preview.
A preview is model code. It runs in an iframe whose `sandbox` is `allow-scripts` only, with a CSP meta in `srcDoc`; `allow-same-origin` is never added, so the code cannot reach the app.
A React preview is the same frame: bundle it into the `srcDoc` yourself, basalt ships no sandbox.

```tsx
import type { defineCatalog } from 'basalt-ui/ai'
import { CodeBlock, Markdown } from 'basalt-ui/content'
import { PageAside } from 'basalt-ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'

type Catalog = ReturnType<typeof defineCatalog>
// A block's `spec` is the tool input the model sent, already parsed; the catalog validates it.
export type Artifact =
  | { kind: 'block'; spec: unknown }
  | { kind: 'markdown' | 'code' | 'html'; lang?: string; body: string }

// The CSP is a meta tag in `srcDoc`: no network, no nested frames. The sandbox has
// `allow-scripts` only; never add allow-same-origin: model code would read the app.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">`

function Body({ a, catalog }: { a: Artifact; catalog: Catalog }) {
  switch (a.kind) {
    case 'markdown':
      return <Markdown contentTrust="untrusted">{a.body}</Markdown>
    case 'block':
      return <catalog.Block spec={a.spec} phase="ready" />
    case 'code':
      return <CodeBlock lang={a.lang ?? 'text'} code={a.body} />
    case 'html':
      return <iframe title="Preview" sandbox="allow-scripts" srcDoc={CSP + a.body} />
  }
}

/** `versions` is oldest first; the newest tab opens. */
export function ArtifactAside({ title, versions, catalog }: Props) {
  return (
    <PageAside title={title}>
      <Tabs defaultValue={String(versions.length)}>
        <TabsList>
          {versions.map((_, i) => (
            <TabsTrigger key={i} value={String(i + 1)}>{`v${i + 1}`}</TabsTrigger>
          ))}
        </TabsList>
        {versions.map((a, i) => (
          <TabsContent key={i} value={String(i + 1)}>
            <Body a={a} catalog={catalog} />
          </TabsContent>
        ))}
      </Tabs>
    </PageAside>
  )
}
type Props = { title: string; versions: readonly Artifact[]; catalog: Catalog }
```
