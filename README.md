# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Design system for the modern stack. One Tailwind theme that makes your components, docs, and charts look like they belong together.

**[Documentation](https://basalt-ui.com)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building modern apps often means combining ShadCN components, Starlight docs, Tremor dashboards, and more — each with its own styling.

Basalt UI is a single Tailwind CSS theme that brings them all together. Import once, get consistent design everywhere. More integrations are on the way.

### Why Basalt UI?

Most teams don't use just one UI tool anymore.

You combine component libraries, documentation frameworks, and charting tools — and they rarely look like they belong together.

Basalt UI solves this with a single Tailwind configuration that works across your stack.

No rewrites. No heavy abstractions. Just consistent design, everywhere.

### What Basalt UI gives you

- One Tailwind theme shared across apps, docs, and dashboards
- Out-of-the-box support for ShadCN, Starlight, and Tremor
- Matching light and dark modes by default
- A consistent look without custom glue code

More integrations will be added over time.

## Install

```bash
npm install basalt-ui
# or
bun add basalt-ui
```

## Usage

Import the CSS in your main stylesheet:

```css
@import "basalt-ui/css";
```

For Starlight docs:

```css
@import "basalt-ui/starlight";
```

## Repository Structure

```
basalt-ui/
├── packages/basalt-ui/    # The npm package
└── apps/web/              # Docs & playground (Astro + Starlight)
```

## Development

```bash
bun install
bun run dev
```

## License

Apache 2.0
