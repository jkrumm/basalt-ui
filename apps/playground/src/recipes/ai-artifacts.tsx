// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:ai-artifacts
import type { defineCatalog } from 'basalt-ui/ai'
import { CodeBlock, Markdown } from 'basalt-ui/content'
import { PageAside } from 'basalt-ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'

type Catalog = ReturnType<typeof defineCatalog>
export type Artifact = { kind: 'markdown' | 'block' | 'code' | 'html'; lang?: string; body: string }

// The CSP is a meta tag in `srcDoc`: no network, no nested frames. The sandbox has
// `allow-scripts` only; never add allow-same-origin: model code would read the app.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">`

function Body({ a, catalog }: { a: Artifact; catalog: Catalog }) {
  switch (a.kind) {
    case 'markdown':
      return <Markdown contentTrust="untrusted">{a.body}</Markdown>
    case 'block':
      return <catalog.Block spec={JSON.parse(a.body)} phase="ready" />
    case 'code':
      return <CodeBlock lang={a.lang ?? 'text'} code={a.body} />
    case 'html':
      return <iframe title="Preview" sandbox="allow-scripts" srcDoc={CSP + a.body} />
  }
}

/** `versions` is oldest first; each version is a tab, the newest opens. */
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
// #endregion
