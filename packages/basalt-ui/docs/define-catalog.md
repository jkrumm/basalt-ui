---
name: defineCatalog
use when: 'an app renders blocks a model chose: every spec passes `validate` or `Block` before any render'
never when: 'there is one fixed component and no model picks it (render the composite directly)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', '@shikijs/langs', '@shikijs/themes', pele, react-markdown, rehype-sanitize, remark-gfm, remend, shiki]
slots: []
---

# defineCatalog

The one validator between model output and render. `validate(spec)` resolves a spec to its block
or returns a model-readable error that ends in advice; `Block` validates, renders inside a
per-block error boundary, draws the composite's own phase skeleton and prints a quiet "could not
be displayed" for a spec it refused or a render that threw, so its siblings keep rendering.
A spec names its block in `block`; `{ discriminator: 'type' }` names another field, and that
field then stays in the props the schema sees (the block's own literal).

## Signature

```ts
defineCatalog(blocks: readonly Block[], options?: { discriminator?: string; }): Catalog
```

`Block`, `Catalog` import from `basalt-ui/ai`: `import type { Block, Catalog } from 'basalt-ui/ai'`.

## Example

```tsx
export const catalog = defineCatalog([stat, table])
// in a tool part's renderer:
<catalog.Block spec={part.input} phase={part.state === 'output-available' ? 'ready' : 'loading'} />
// in a test file:
test('catalog', () => expectCatalog(catalog))
```
