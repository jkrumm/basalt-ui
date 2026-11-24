## basalt-ui — Agent Quick Reference

> Maintaining this package? Read `packages/basalt-ui/MAINTAINING.md` first (repo-only — not in the tarball).

React 19 framework on Base UI and Tailwind 4: `BasaltProvider` (`basalt-ui`, re-exported by `basalt-ui/router`), app shell, TanStack Charts
chart system with a three-tier `--basalt-*` CSS-variable token system, and TanStack adapter batteries.
Toolchain: Bun runtime, oxlint + oxfmt, conventional commits (empty scope), `master` branch.

## Subpath ownership

The package ships the subpaths below. Their layer and purpose are the contract in `docs/agents/subpaths.md` (repo root), which `tests/drift.test.ts` checks against `src/surfaces.ts`; Read it before adding, moving or removing an export.
Everything else is internal: `./guard`, `./data/virtual`, `./llms.txt` and `./package.json` are **not exports**
(`llms.txt` still ships in the tarball as a file; `basalt-ui tokens:css` emits the token stylesheet).

| Subpath                  | Layer         |
| ------------------------ | ------------- |
| `basalt-ui`              | ui            |
| `basalt-ui/charts`       | headless      |
| `basalt-ui/tokens`       | headless      |
| `basalt-ui/vite`         | build-tooling |
| `basalt-ui/table`        | ui            |
| `basalt-ui/content`      | ui            |
| `basalt-ui/controls`     | ui            |
| `basalt-ui/router`       | headless      |
| `basalt-ui/data`         | headless      |
| `basalt-ui/form`         | ui            |
| `basalt-ui/page`         | ui            |
| `basalt-ui/cards`        | ui            |
| `basalt-ui/motion`       | ui            |
| `basalt-ui/ai`           | ui            |
| `basalt-ui/ui/*`         | ui            |
| `basalt-ui/core/*`       | ui            |
| `basalt-ui/shell`        | ui            |
| `basalt-ui/lint`         | build-tooling |
| `basalt-ui/stylelint`    | build-tooling |
| `basalt-ui/testing`      | build-tooling |
| `basalt-ui/theme-script` | build-tooling |
| `basalt-ui/static`       | ui            |
| `basalt-ui/astro`        | build-tooling |

## Hard rules

**Framework-free boundary**: the layer is `basalt-ui/charts` and `basalt-ui/tokens`; each imports no UI
framework. `@visx/*` is banned everywhere, in consumers by `basalt/import-boundary` and in this repo's
own source by a `no-restricted-imports` override; `@tanstack/charts/react` is imported by
`src/charts/host.tsx` alone (the same override, lifted for that one file). Why it exists: `docs/agents/layering.md`.

**Agent and model output** goes through `basalt-ui/content` with `contentTrust="untrusted"`: no `<img>`
(`images="same-origin"` admits relative srcs), links only to same-origin, https:, mailto: and tel:, and no
`sanitize` or `rehypePlugins`. `contentTrust` is required and independent of `streaming`, a rendering mode only;
a missing or unknown value renders as untrusted. `contentTrust="trusted"` takes `sanitize` (`allowTags`,
`allowAttrs` additions over a fixed policy that runs last) and `rehypePlugins`.

**No raw hex or raw color functions**: route every color through `BASALT.*` tokens or the shipped
CSS vars. Never write `#rrggbb`, `rgb(…)`, or `hsl(…)` in component or style code. Use
`alpha(token, a)` for opacity (`color-mix` under the hood) — never `rgba()`.

**Motion discipline**: import animation from `motion/react`, never the raw `framer-motion`
package (enforced by oxlint `no-restricted-imports`). Time it with the scale from `basalt-ui/tokens`
(`MOTION_DURATION`, `MOTION_SPRING`, `MOTION_EASE_STANDARD` / `_ENTER` / `_EXIT`, `staggerDelay`), or in CSS
with `--basalt-dur-*`, `--basalt-ease-*`, `--basalt-spring` and the `duration-fast` / `ease-enter` classes;
enter and exit come from `useMotionPreset` (`basalt-ui/motion`) or `animate-enter-*`, which collapse under
reduced motion on their own. A literal duration, delay, spring or easing is a `basalt/motion-literal` finding.

**The escape hatch is `// oxlint-disable-next-line basalt/<rule-id> -- <why>`**, scoped to that one rule
and line; a waiver without `-- <why>` is itself a finding (`basalt/waiver-needs-reason`). The 2.x
`theme-allow` and `theme-allow-file` annotations are inert: no rule reads them.

## Branches

- Before changing `bin/basalt-ui.mjs` or anything under `src/cli/`, Read `docs/agents/cli.md`: the commands, the one resolver, the local-bin rule, the editor hook.
- Before changing `package.json` peers, `scripts/check-dist-layering.mjs` or `scripts/pack-test.sh`, Read `docs/agents/layering.md`: why the layer is UI-free and what the packaging gate proves.

## Machine-readable surface map

`llms.txt` in the package root (`node_modules/basalt-ui/llms.txt`, a shipped file, not an export) is the full surface
map: one entry per published subpath, with import specifier, description, layer and optional peer packages.

## Upgrading across minors

`CHANGELOG.md` lists every release; `MIGRATING.md` lists what **broke** — removed and renamed
exports per minor, with the replacement. 3.x is the current line; 2.x stays on npm as published and
receives no further releases, so a consumer on 2.x stays on its pin until it migrates. A minor bump
can still require code changes. Read `MIGRATING.md` before jumping more than one minor.
