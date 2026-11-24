---
name: expectCatalog
use when: 'a test file holds the `defineCatalog` product of an app to the sample, limit and hostile-URL contract'
never when: 'the code runs in an app bundle, or the question is the look of a block (use a layout or screenshot test)'
subpath: basalt-ui/testing
peers: ['@axe-core/playwright']
slots: []
---

# expectCatalog

The one contract test every app catalog runs: samples, limits and hostile URLs. It throws one
error that lists every failure.

## Signature

```ts
expectCatalog(catalog: CatalogLike): void
  validate: (x: unknown) => { ok: true; block: unknown; } | { ok: false; error: string; }
  blocks: readonly { name: string; props: unknown; sample: readonly unknown[]; limits?: { maxBytes: number; maxDepth: number; }; textKeys?: readonly string[]; }[]
  discriminator?: string
  Block?: FC<{ spec: unknown; phase: Phase; }>
```

`Phase` import from `basalt-ui/cards`: `import type { Phase } from 'basalt-ui/cards'`.

## Example

```tsx
test('the show catalog', () => expectCatalog(catalog))
```
