# Flicker-Free Dark Mode in Astro + React SSG

## The Problem

Static sites (SSG) face a unique challenge with dark mode: the theme preference is stored client-side (localStorage), but the HTML is pre-rendered on the server. This creates a timing mismatch:

1. Server renders HTML → doesn't know user's theme preference
2. Browser displays HTML → shows default theme (usually light)
3. JavaScript loads → reads localStorage, applies correct theme
4. Result: **visible flash** as theme switches

Users see a white flash in dark mode, or black flash in light mode. This happens on every page load, navigation, and refresh.

## Why Traditional Solutions Fail

### ❌ React State Only
```tsx
// This causes flicker
const [theme, setTheme] = useState('light')

useEffect(() => {
  const stored = localStorage.getItem('theme')
  setTheme(stored || 'light')
}, [])
```

**Problem**: Theme applies after React hydrates (too late).

### ❌ CSS-Based Detection
```css
/* This misses user preferences */
@media (prefers-color-scheme: dark) {
  /* styles */
}
```

**Problem**: Only detects system preference, doesn't respect manual user choice.

### ❌ Server-Side Cookies
```ts
// Requires SSR adapter
const theme = Astro.cookies.get('theme')
```

**Problem**: Adds complexity, requires server runtime, breaks static deployment.

## The Solution: Inline Blocking Script

The key insight: **Apply theme before first paint** using a synchronous inline script in `<head>`.

### Architecture

```
Server (Build) → Blocking Script → React Hydration
      ↓               ↓                   ↓
  Static HTML  → Apply theme      → Interactive UI
                 (no flicker)
```

### Three-State System

- **System**: Follow OS preference (default)
- **Light**: Force light mode
- **Dark**: Force dark mode

## Implementation

### 1. Blocking Theme Script

**File**: `apps/web/src/components/shared/ThemeScript.astro`

```astro
<script is:inline>
  const getThemePreference = () => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
    return 'system'
  }

  const preference = getThemePreference()
  const root = document.documentElement

  // Resolve system preference to actual theme
  let resolvedTheme = preference
  if (preference === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  if (resolvedTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // Store both preference and resolved theme for hydration
  root.setAttribute('data-theme-preference', preference)
  root.setAttribute('data-theme', resolvedTheme)
</script>
```

**Key aspects:**

- `is:inline` directive: Prevents Vite from bundling/transforming
- Runs synchronously: No async, no imports, no delays
- Reads localStorage immediately: Before any rendering
- Sets data attributes: For React to read during hydration
- Resolves "system": Checks `prefers-color-scheme` media query

### 2. React Toggle Component

**File**: `apps/web/src/components/shared/ThemeToggle.tsx`

```tsx
import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark' | 'system'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  // Get initial theme from DOM on mount
  useEffect(() => {
    const preference = document.documentElement.getAttribute(
      'data-theme-preference',
    ) as Theme | null
    if (preference) {
      setTheme(preference)
    }
    setMounted(true)
  }, [])

  // Listen to system preference changes when theme is set to system
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
      document.documentElement.setAttribute(
        'data-theme',
        e.matches ? 'dark' : 'light',
      )
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const cycleTheme = () => {
    // Cycle: system -> light -> dark -> system
    const nextTheme: Theme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'

    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)

    const root = document.documentElement
    root.setAttribute('data-theme-preference', nextTheme)

    // Resolve theme
    if (nextTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
      root.classList.toggle('dark', systemDark)
      root.setAttribute('data-theme', systemDark ? 'dark' : 'light')
    } else {
      root.classList.toggle('dark', nextTheme === 'dark')
      root.setAttribute('data-theme', nextTheme)
    }
  }

  const icons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  const labels = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  }

  const Icon = icons[theme]

  // Show loading state until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="outline"
        aria-label="Loading theme toggle"
        className="cursor-pointer gap-2"
        type="button"
        disabled
      >
        <Monitor className="h-4 w-4" />
        <span>System</span>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={cycleTheme}
      aria-label={`Current theme: ${theme}. Click to cycle.`}
      className="cursor-pointer gap-2"
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span>{labels[theme]}</span>
    </Button>
  )
}
```

**Key aspects:**

- `mounted` state: Prevents hydration mismatch
- Reads from DOM: Gets server-set `data-theme-preference` attribute
- Loading state: Shows default icon until hydrated
- Cycles through modes: Simple click to cycle (no dropdown)
- Media query listener: Auto-updates when OS theme changes
- Updates both DOM and localStorage: Keeps everything in sync

### 3. Layout Integration

**File**: `apps/web/src/layouts/Layout.astro`

```astro
---
import ThemeScript from '@/components/shared/ThemeScript.astro'
import ThemeToggle from '@/components/shared/ThemeToggle'
---

<!doctype html>
<html lang="en">
  <head>
    <ThemeScript />
    <!-- ... other head content -->
  </head>
  <body>
    <header>
      <nav>
        <!-- ... -->
        <ThemeToggle client:load />
      </nav>
    </header>
    <slot />
  </body>
</html>
```

**Key aspects:**

- ThemeScript first in `<head>`: Runs before any rendering
- ThemeToggle with `client:load`: Hydrates when page loads
- No SSR for toggle: Pure client-side React component

### 4. CSS Configuration

**File**: `packages/basalt-ui/src/index.css`

```css
:root {
  --background: oklch(0.985 0.002 90);
  --foreground: oklch(0.265 0.015 285);
  /* ... other tokens */
}

.dark {
  --background: oklch(0.21 0.012 285);
  --foreground: oklch(0.935 0.005 90);
  /* ... other tokens */
}
```

**Key aspects:**

- `.dark` class selector: Applied by blocking script
- CSS variables: All theme tokens use CSS custom properties
- No media queries needed: Script handles everything
- OKLCH color space: Perceptually uniform colors

## Technical Deep Dive

### Why `is:inline` Matters

```astro
<!-- ❌ Without is:inline -->
<script>
  // Vite bundles this into a separate JS file
  // Loads asynchronously after HTML parse
  // Too late to prevent flicker
</script>

<!-- ✅ With is:inline -->
<script is:inline>
  // Stays in HTML, executes immediately
  // Runs during HTML parse, before render
  // Blocks first paint until complete
</script>
```

### Hydration Mismatch Prevention

**Problem**: Server renders one state, client renders another.

```tsx
// ❌ Causes hydration mismatch
const [theme, setTheme] = useState(() => {
  // This runs on server (no localStorage)
  // And on client (has localStorage)
  // Different values = mismatch
  return localStorage.getItem('theme') || 'system'
})
```

**Solution**: Wait for client mount.

```tsx
// ✅ Prevents hydration mismatch
const [mounted, setMounted] = useState(false)

useEffect(() => {
  // Only runs on client
  const preference = document.documentElement.getAttribute(...)
  setTheme(preference)
  setMounted(true)
}, [])

if (!mounted) {
  // Show loading state (matches server render)
  return <Button disabled>...</Button>
}

// Show interactive state (only on client)
return <Button onClick={...}>...</Button>
```

### System Preference Listening

```tsx
useEffect(() => {
  if (theme !== 'system') return

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) => {
    // Update DOM immediately when OS theme changes
    document.documentElement.classList.toggle('dark', e.matches)
  }

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}, [theme])
```

**Behavior**: When user changes OS theme while app is open, it updates automatically (only if theme is set to "System").

## Trade-offs and Decisions

### Why Not Cookies?

**Pros**: Available during SSR, no flicker possible
**Cons**:
- Requires SSR adapter (breaks static deployment)
- Cookie overhead on every request
- More complex server logic
- Not needed for static sites

**Verdict**: Blocking script is simpler and works with pure SSG.

### Why Cycling Button vs Dropdown?

**Dropdown Issues**:
- Requires hydration to show correct option
- Causes flicker (shows wrong state initially)
- More complex UI with multiple elements

**Cycling Button**:
- Single element, no layout shift
- Icon shows correct state from server render
- Simple interaction (click to cycle)
- Common pattern (System → Light → Dark → System)

### Why Store Both Preference and Resolved Theme?

```js
root.setAttribute('data-theme-preference', 'system')  // User's choice
root.setAttribute('data-theme', 'dark')               // Actual theme
```

**Reason**: "System" can resolve to either light or dark. We need:
- **Preference**: For React to show correct button label
- **Resolved**: For CSS to apply correct theme immediately

## Performance Characteristics

- **No flash**: Theme applied before first paint
- **Zero layout shift**: Button renders correct size from start
- **Minimal JS**: ~2KB for blocking script + React component
- **No network delay**: Everything in HTML, no external requests
- **Fast hydration**: Simple component, quick to interactive

## Browser Support

- **Modern browsers**: Full support (Chrome 90+, Firefox 88+, Safari 14+)
- **IE11**: Falls back to light theme (no localStorage, no CSS variables)
- **Graceful degradation**: Works without JavaScript (uses default theme)

## Testing Checklist

- [ ] Fresh page load in light mode → no dark flash
- [ ] Fresh page load in dark mode → no white flash
- [ ] Hard refresh → theme persists
- [ ] Clear localStorage → defaults to system preference
- [ ] Change OS theme → auto-updates when set to "System"
- [ ] Click button → cycles through themes smoothly
- [ ] Page navigation → theme persists (no flash)
- [ ] Browser back/forward → theme persists
- [ ] Disabled JavaScript → shows default theme (light)

## Common Pitfalls

### 1. Async Script Loading

```astro
<!-- ❌ Wrong: Async loading -->
<script src="/theme.js"></script>

<!-- ✅ Correct: Inline blocking -->
<script is:inline>
  // Theme code here
</script>
```

### 2. Reading localStorage Too Late

```tsx
// ❌ Wrong: After hydration
useEffect(() => {
  const theme = localStorage.getItem('theme')
  applyTheme(theme)
}, [])

// ✅ Correct: Before render (in blocking script)
```

### 3. Forgetting Hydration Mismatch

```tsx
// ❌ Wrong: Different server/client state
const [theme] = useState(localStorage.getItem('theme'))

// ✅ Correct: Wait for mount
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
```

### 4. Media Query in CSS Only

```css
/* ❌ Wrong: Only detects system, ignores user choice */
@media (prefers-color-scheme: dark) {
  body { background: black; }
}

/* ✅ Correct: Class-based with script */
.dark body { background: black; }
```

## Alternative Approaches

### next-themes Package

Popular in Next.js ecosystem. Similar approach but:
- More features (forced color scheme, theme provider)
- Larger bundle size
- Framework-specific (React only)

Our solution:
- Minimal, focused on the problem
- Framework-agnostic (plain HTML + CSS)
- Easy to understand and customize

### astro-themes Package

Dedicated Astro package. Provides:
- Similar inline script approach
- Pre-built components
- Good documentation

Our solution:
- Full control over implementation
- No external dependency
- Tailored to our design system

### CSS Variables Only

Using CSS variables with media queries:
- No JavaScript required
- Always respects system preference
- Cannot override system preference

Our solution adds user choice while respecting system as default.

## Key Takeaways

1. **Blocking inline scripts** are the only way to prevent flicker in SSG
2. **Data attributes** bridge the gap between server and client state
3. **Mounted state** prevents React hydration mismatches
4. **System preference** should be default, with manual override option
5. **CSS variables** make theme switching instant (no re-render needed)

## Further Reading

- [Astro Script Directives](https://docs.astro.build/en/reference/directives-reference/#isinline)
- [React Hydration](https://react.dev/reference/react-dom/client/hydrateRoot)
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
