# Basalt UI

Framework-agnostic design system built on Tailwind CSS. Zinc-based colors, works with any framework.

## Structure

```
basalt-ui/
├── packages/basalt-ui/    # Framework-agnostic theme (Tailwind preset + CSS)
└── apps/web/              # Docs & playground (Astro + React + Starlight)
```

## Install

```bash
npm install basalt-ui
```

## Usage

```js
// tailwind.config.js
module.exports = {
  presets: [require('basalt-ui/tailwind.preset')],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
}
```

```js
// Import CSS in your app entry point
import 'basalt-ui/src/index.css'
```

**Optional**: Add ShadCN components (React only):
```bash
npx shadcn@latest add button
```

## Development

```bash
bun install
bun run dev
```

## License

Apache 2.0
