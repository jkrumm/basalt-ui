---
name: defineCatalog
use when: 'an app renders blocks a model chose: every spec passes `validate` or `Block` before any render'
never when: 'there is one fixed component and no model picks it (render the composite directly)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: []
---

# defineCatalog

The one validator between model output and render. `validate(spec)` resolves a spec to its block
or returns a model-readable error that ends in advice; `Block` validates, renders inside a
per-block error boundary, draws the composite's own phase skeleton and prints a quiet "could not
be displayed" for a spec it refused or a render that threw, so its siblings keep rendering.

## Signature

```ts
defineCatalog(blocks: readonly Block[]): Catalog
```
