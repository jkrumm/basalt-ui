---
name: basalt
use when: 'a Vite app imports basalt-ui v3 subpaths, at profile `parts` or `app`'
never when: 'the app is not built with Vite; it then lists its own Tailwind sources'
subpath: basalt-ui/vite
peers: [vite, vite-plugin-pwa]
slots: []
---

# basalt

The v3 Vite plugin: fails the build on a missing peer (an `add …` line) or a stale ejected seed
(`basalt-ui sync`), aliases ejected primitives, writes `.basalt/sources.css` and owns the head
(theme script, theme-color, manifest). A module that imports `basalt-ui/table` also gets
`basalt-ui/table.css`, the table tiers, so the app never imports it. Full contract: `docs/vite.md`.

## Signature

```ts
basalt(options?: BasaltOptions): PluginOption[]
  themeScript?: false | ThemeScriptOptions  // Options for the pre-paint scheme script, or `false` to leave it out
  themeColor?: false | "auto" | ColorPair  // `'auto'` (default): the `--basalt-canvas` pair of the default palette; or a flat pair; `false`: none
  app?: BasaltAppOptions
  sources?: boolean  // Write `.basalt/sources.css`
```

`ThemeScriptOptions` import from `basalt-ui/theme-script`: `import type { ThemeScriptOptions } from 'basalt-ui/theme-script'`.

`ColorPair` import from `basalt-ui/tokens`: `import type { ColorPair } from 'basalt-ui/tokens'`.

## Example

```tsx
export default { plugins: [react(), tailwindcss(), basalt({ app: { name: 'Argo' } })] }
```
