---
name: expectCatalog
use when: 'a test file holds the `defineCatalog` product of an app to the sample, limit and hostile-URL contract'
never when: 'the code runs in an app bundle, or the question is the look of a block (use a layout or screenshot test)'
subpath: basalt-ui/testing
peers: []
slots: []
---

# expectCatalog

The one contract test every app catalog runs. It throws one error listing every failure:

## Signature

```ts
expectCatalog(catalog: CatalogLike): void
  validate: (x: unknown) => { ok: true; block: unknown; } | { ok: false…
  blocks: readonly { name: string; props: unknown; sample: readonly u…
```
