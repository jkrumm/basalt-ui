# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Opinionated framework for React apps on Base UI and Tailwind 4 — tokens, app shell, chart system, and the agentic layer to drive them.

**[Documentation](https://github.com/jkrumm/basalt-ui/tree/master/packages/basalt-ui#readme)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building a dashboard app means wiring a primitive set, a chart system, a typed token layer, and an app shell — each with its own opinions, and none of them talking to each other. Basalt UI is the extraction of that setup from a production app: install once, get a coherent system.

## Install

```bash
bun add basalt-ui
# every peer is optional: install what the subpaths you import need
bun add react react-dom @base-ui/react tailwindcss @tanstack/react-router @tanstack/react-query
```

Scaffold the repo doctrine (Claude Code rules + skills, `AGENTS.md` block, `DESIGN.md` seed, toolchain seeds):

```bash
bunx basalt-ui init
```

**Quick start, the 15-subpath export table, token system, and adapter batteries (upgrading from 2.x: `MIGRATING.md` § 2.x to 3.0):** see the
[package README](./packages/basalt-ui/README.md).

Not a React app? The token system works without one — no React, no bundler:

```bash
bunx basalt-ui tokens:css --out src/tokens.css
```

## Repository Structure

```
basalt-ui/
├── packages/basalt-ui/    # the published npm package (basalt-ui)
├── apps/playground/       # @basalt-ui/playground — workspace:* consumer, everyday iteration surface
├── apps/expression/       # @basalt-ui/expression — the expression trial scenarios
└── apps/marketing/        # basalt-ui.com — content-frozen until rebuilt on v3
```

## Development

```bash
bun install
bun run dev              # = dev:playground
```

## License

Apache 2.0
