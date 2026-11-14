---
name: defineBlock
use when: 'a model may ask the page to show a typed piece of UI (a stat, a list, a table) through a tool call or a data part'
never when: 'the content is model text (use partView, which renders it as untrusted markdown) or the UI is authored by the app, not chosen by a model'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: []
---

# defineBlock

Declares one block a model may show: its name and description (what a tool definition reads),
a Standard Schema for its props, at least one `sample` (what `expectCatalog` renders and fuzzes)
and `render`, which returns the composite as its root so `Block` can hand it the phase. `limits`
default to 32 KiB and depth 6 and may tighten that or raise it to 512 KiB and depth 12.
`textKeys` names url-named keys (`href`, `src`, `url`, `link`) the block draws as text, so a data
cell holding `http://…` is not a refusal; `expectCatalog` still fuzzes them for an attribute. `reserve` is the escape rung for a layout block
that composes several composites: its loading and error arms draw a box that tall.

## Signature

```ts
defineBlock<S extends StandardSchemaV1>(b: DefineBlockOptions<S>): Block<S>
  name: string
  description: string
  props: S
  limits?: { maxBytes: number; maxDepth: number; }
  textKeys?: readonly string[]
  sample: readonly Infer<S>[]
  render: (p: Infer<S>, box: Box) => ReactNode
  reserve?: number
```
