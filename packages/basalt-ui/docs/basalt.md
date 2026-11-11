---
name: basalt
use when: 'a Vite app imports basalt-ui v3 subpaths, at profile `parts` or `app`'
never when: 'the app is not built with Vite; it then lists its own Tailwind sources'
subpath: basalt-ui/vite
peers: [vite, vite-plugin-pwa]
slots: []
---

# basalt

The v3 Vite plugin: fails the build on a missing peer (`bun add …`) or a stale ejected seed
(`basalt-ui sync`), aliases ejected primitives, writes `.basalt/sources.css` and owns the head
(theme script, theme-color, manifest). Full contract: `docs/vite.md`.

## Signature

```ts
basalt(options?: BasaltOptions): PluginOption[]
  themeScript?: false | ThemeScriptOptions
  themeColor?: false | "auto" | ColorPair
  app?: BasaltAppOptions
  sources?: boolean
```
