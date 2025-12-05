# Basalt UI

Framework-agnostic Tailwind CSS design system with zinc-based colors.

## Installation

```bash
npm install basalt-ui tailwindcss@next
```

## Usage

### 1. Configure Tailwind

In `tailwind.config.js`:

```javascript
import { preset } from 'basalt-ui'

export default {
  presets: [preset],
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
}
```

### 2. Import CSS

In your app's main CSS:

```css
@import 'basalt-ui/src/index.css';
```

Or in JavaScript:

```javascript
import 'basalt-ui/src/index.css'
```

### 3. Use Classes

```html
<div class="bg-background text-foreground p-4">
  <h1 class="text-primary">Hello</h1>
  <button class="bg-primary text-background">Click me</button>
</div>
```

## Dark Mode

Toggle `.dark` class on `<html>` element:

```javascript
document.documentElement.classList.toggle('dark')
```

## Colors

- `background` / `foreground` - Base theme
- `primary` - Primary action color
- `muted` - Secondary/disabled state
- `border` - Borders
- `ring` - Focus rings

All colors support light/dark via CSS variables.

## Framework Support

Works with any framework: React, Vue, Svelte, Astro, vanilla JS, etc.

## License

Apache 2.0
