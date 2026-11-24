---
name: defineBlock
use when: 'a model may ask the page to show a typed piece of UI (a stat, a list, a table) through a tool call or a data part'
never when: 'the content is model text (use partView, which renders it as untrusted markdown) or the UI is authored by the app, not chosen by a model'
subpath: basalt-ui/ai
peers: ['@base-ui/react', '@shikijs/langs', '@shikijs/themes', pele, react-markdown, rehype-sanitize, remark-gfm, remend, shiki]
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
  limits?: { maxBytes: number; maxDepth: number; }  // Always enforced; a default applies when omitted
  textKeys?: readonly string[]  // Url-named keys (`href`, `src`, `url`, `link`) whose values this block draws as text, never as a link: `validate` skips them, so a data cell holding `http://…` no longer refuses the block
  sample: readonly Infer<S>[]
  render: (p: Infer<S>, box: Box) => ReactNode
  reserve?: number  // Escape rung: a layout block composing several composites; single composites own their phase heights
```

`Block`, `DefineBlockOptions`, `Infer` import from `basalt-ui/ai`: `import type { Block, DefineBlockOptions, Infer } from 'basalt-ui/ai'`.

`Box` import from `basalt-ui`: `import type { Box } from 'basalt-ui'`.

## Example

```tsx
export const stat = defineBlock({
  name: 'stat',
  description: 'One headline number with a delta. Never for lists.',
  props: z.object({ label: z.string().max(40), value: z.number(), delta: z.number().optional() }),
  sample: [{ label: 'Shipped', value: 388, delta: 12 }],
  render: (p) => (
    <StatCard
      title={p.label}
      value={p.value}
      {...(p.delta !== undefined && { delta: { value: p.delta, polarity: 'up-good' } })}
    />
  ),
})
```
