---
name: basalt-app
description: Scaffold, wire, verify or upgrade a basalt-ui app — `basalt-ui init`, `doctor`, `sync`, and the 1.x to 2.0 upgrade path.
when_to_use: User is adding basalt-ui to an app, wiring BasaltProvider / BasaltShell / the vite preset, upgrading basalt-ui, refreshing the shipped rules, or wiring a freshness check in CI. Also when /basalt-design reports no DESIGN.md.
---

Procedure only; the law is `.claude/rules/basalt-*.md`.

## Scaffold

1. `bun add basalt-ui && bunx basalt-ui init` (the only `bunx` call; use `./node_modules/.bin/basalt-ui` after).
2. Check the seeded `src/main.tsx` (`init` writes it when absent); `basalt-ui/styles.css` is the only stylesheet import:

```tsx
import 'basalt-ui/styles.css'
import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import { routeTree } from './routeTree.gen'

const router = createBasaltRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
// createRoot(root).render(<BasaltProvider router={router} />)
```

3. If you use `basalt-ui/controls-dates`, import `@mantine/dates/styles.layer.css` before `basalt-ui/styles.css`.
4. In `vite.config.ts`: `...basaltViteConfig({ port, apiTarget })` and `plugins: [react(), ...basaltAppPlugin({ name, description })]`.
5. In `src/routes/__root.tsx`: `<BasaltShell brand={{ name }} nav={NAV}><Outlet /></BasaltShell>`; build `NAV` with `defineNav` in `src/lib/nav.tsx`.
6. Fill in `DESIGN.md` (identity, series dictionary, deviations).

## Verify

1. `./node_modules/.bin/basalt-ui doctor`; read to the last line. `SKIPPED` exits non-zero.
2. Fix every finding doctor prints, then rerun until it is clean.
3. `bun run lint:basalt` (`oxlint . && basalt-ui check-theme`); fix every finding at its source.
4. `bunx tsc --noEmit`; fix every error without `as never` or `any`.

## Refresh after any upgrade

1. `./node_modules/.bin/basalt-ui sync` (`--check` in CI, `--force` overwrites local edits).
2. Read its output: edited files are skipped, retired files are deleted, the AGENTS.md block is rewritten.

## Upgrade 1.x to 2.0

1. `bun add basalt-ui@latest`, then `./node_modules/.bin/basalt-ui sync`; it prunes retired managed files and rewrites the AGENTS.md block.
2. `./node_modules/.bin/basalt-ui doctor`; fix each of doctor's checks: a tsconfig that does not extend the shipped base, `basalt/*` rule ids the plugin no longer has, and imports of subpaths 2.0 dropped.
3. Work through `MIGRATING.md` § 2.0 (in the installed package): one row per removal or move; apply each that your code touches.
4. Run the Verify steps above.

## Not a React app

1. `bunx basalt-ui tokens:css --out src/tokens.css` and `bunx basalt-ui fonts:css --out src/fonts.css`.
2. Set `"basalt": { "profile": "tokens-only" }` in `package.json` by hand.
