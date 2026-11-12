---
name: renderStylelintConfig
use when: 'a tool writes the consumer''s stylelint config and must list the generated token sheets in `ignoreFiles`'
never when: 'an app only extends the preset (`extends: [''basalt-ui/stylelint'']`) and has no generated sheet to ignore'
subpath: basalt-ui/stylelint
peers: []
slots: []
---

# renderStylelintConfig

The text of `.stylelintrc.basalt.json`: the closed stylelint preset with `ignoreFiles` listing the
generated token sheets. `sync` writes it and `sync --check` compares bytes.

## Signature

```ts
renderStylelintConfig(options?: RenderOptions): string
  ignoreFiles?: readonly string[]
```
