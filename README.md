# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Opinionated framework for Mantine v9 React apps — theme, app shell, chart system, and the agentic layer to drive them.

**[Documentation](https://github.com/jkrumm/basalt-ui/tree/master/packages/basalt-ui#readme)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building a dashboard app means wiring a Mantine theme, a chart system, a typed token layer, and an app shell — each with its own opinions, and none of them talking to each other. Basalt UI is the extraction of that setup from a production app: install once, get a coherent system.

## Install

```bash
bun add basalt-ui
bun add react react-dom @mantine/core @mantine/hooks @mantine/modals @mantine/notifications @mantine/spotlight \
  @tanstack/react-router @tanstack/react-query \
  @fontsource-variable/hubot-sans @fontsource-variable/jetbrains-mono @fontsource-variable/nunito-sans
```

Scaffold the repo doctrine (Claude Code rules + skills, `AGENTS.md` block, `DESIGN.md` seed, toolchain seeds):

```bash
bunx basalt-ui init
```

**Quick start, the 15-subpath export table, token system, and adapter batteries (upgrading from 1.x: `MIGRATING.md` § 2.0.0):** see the
[package README](./packages/basalt-ui/README.md).

Not a React app? The token system works without one — no React, no Mantine, no bundler:

```bash
bunx basalt-ui tokens:css --selector-attribute data-theme --only core --out src/tokens.css
```

See [Framework-free token consumption](./docs/FRAMEWORK-FREE.md).

## Repository Structure

```
basalt-ui/
├── packages/basalt-ui/    # the published npm package (basalt-ui)
├── apps/playground/       # @basalt-ui/playground — workspace:* consumer, everyday iteration surface
└── apps/marketing/        # basalt-ui.com — content-frozen until rebuilt on Mantine
```

## Development

```bash
bun install
bun run dev              # = dev:playground
```

## License

Apache 2.0
