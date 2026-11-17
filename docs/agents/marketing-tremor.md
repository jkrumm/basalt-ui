# Marketing app: Tremor Raw integration

## Tremor Raw Integration

This project uses **Tremor Raw** for data visualization components. Tremor Raw is copied into the project (not installed as dependency) similar to ShadCN.

### Architecture

**Component Structure:**

```
src/
├── components/
│   ├── ui/              # ShadCN components (CVA variants)
│   ├── tremor/          # Tremor Raw components (tailwind-variants)
│   └── ...
├── lib/
│   ├── utils.ts         # Merged utilities (cn() + cx())
│   ├── chartUtils.ts    # Tremor chart utilities
│   └── useOnWindowResize.ts  # Chart responsiveness hook
```

**Dependencies:**

- **Tremor-specific**: `tailwind-variants`, `@remixicon/react`, `recharts`
- **Shared with ShadCN**: `clsx`, `tailwind-merge`, Radix UI primitives
- **Coexistence**: Both CVA (ShadCN) and tailwind-variants (Tremor) work together

### Critical: Astro Usage Pattern

**All Tremor chart components MUST use `client:only="react"`:**

```astro
---
import { Card } from '@/components/tremor/Card';
import { AreaChart } from '@/components/tremor/AreaChart';
---

<!-- Card can use client:load -->
<Card client:load>
  <h3>Monthly Views</h3>

  <!-- Charts MUST use client:only="react" -->
  <div class="h-72">
    <AreaChart
      client:only="react"
      data={chartData}
      index="date"
      categories={["views"]}
      colors={["blue"]}
    />
  </div>
</Card>
```

**Why `client:only="react"` is required:**

- Tremor uses **Recharts** internally for all chart rendering
- Recharts accesses browser APIs (`window`, `document`) during render
- SSR will fail with "window is not defined" errors
- Hydration mismatches occur (server HTML doesn't match client SVG)
- Solution: Skip server rendering entirely with `client:only`

**Alternative directives that WON'T work:**

- ❌ `client:load` - Still attempts SSR, causes hydration errors
- ❌ `client:visible` - Same SSR issue
- ❌ No directive - Will fail at build time

### Color Compatibility

Tremor components automatically use Basalt UI color tokens through the CSS definitions:

```tsx
// Named colors map to Basalt UI tokens
<AreaChart
  colors={['blue', 'emerald', 'violet']}
  // Uses --color-blue-500, --color-emerald-500, --color-violet-500
/>
```

**Available chart colors:**

- `blue` (primary), `red` (error), `emerald` (success - maps to green), `amber` (warning - maps to yellow)
- `violet` (accent - maps to purple), `cyan`, `indigo`
- `chart-1` through `chart-5` (categorical: blue, red, green, yellow, purple)
- `chart-blue-1` through `chart-blue-8` (sequential blues)

**How it works:**

- Basalt UI CSS defines all color shades (50-950) for each named color
- Tremor's `chartUtils.ts` generates classes like `bg-blue-500`, `stroke-emerald-600`
- These Tailwind classes are mapped to Basalt UI OKLCH tokens via `@theme inline` block
- Dark mode automatically switches to appropriate OKLCH values

### Utilities

**Merged in `lib/utils.ts`:**

```typescript
// ShadCN utility (class-variance-authority)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tremor utility (identical implementation, different name for compatibility)
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

// Tremor focus/error utilities
export const focusInput = [...]
export const focusRing = [...]
export const hasErrorInput = [...]
```

**Why both `cn()` and `cx()`?**

- ShadCN components import `cn()`, Tremor components import `cx()`
- Identical implementation (both use clsx + tailwind-merge)
- Keeps both libraries' import statements unchanged

### Chart Utilities

**Separate file `lib/chartUtils.ts`:**

```typescript
// Color definitions and utilities
export const chartColors = { blue: {...}, emerald: {...}, ... }
export const getColorClassName = (color, type) => {...}
export const constructCategoryColors = (categories, colors) => {...}

// Chart-specific helpers
export const getYAxisDomain = (autoMinValue, minValue, maxValue) => {...}
export const hasOnlyOneValueForKey = (array, keyToCheck) => {...}
```

### Common Patterns

**Basic Area Chart:**

```astro
---
const data = [
  { date: 'Jan', views: 2400 },
  { date: 'Feb', views: 1398 },
  // ...
];
---

<Card client:load>
  <h3 class="text-h4 mb-4">Page Views</h3>
  <div class="h-72">
    <AreaChart
      client:only="react"
      data={data}
      index="date"
      categories={["views"]}
      colors={["blue"]}
    />
  </div>
</Card>
```

**Multi-Series Chart:**

```astro
<AreaChart
  client:only="react"
  data={salesData}
  index="month"
  categories={["product1", "product2"]}
  colors={["blue", "emerald"]}
/>
```

**Chart Height:**
Always wrap charts in containers with explicit height (Recharts needs defined viewport):

```astro
✅ <div class="h-72"><AreaChart ... /></div>
✅ <div class="h-96"><AreaChart ... /></div>
❌ <div><AreaChart ... /></div>  <!-- Will render at 0px height -->
```

**IMPORTANT: Function Props Limitation**
Astro's `client:only` cannot serialize functions, so props like `valueFormatter`, `onValueChange`, `tooltipCallback`, and `customTooltip` cannot be passed from `.astro` files. Charts will use default formatters (numbers as strings). For custom formatting, create a wrapper React component.

### Known Issues & Solutions

**Issue: Recharts "width(-1) and height(-1)" error**

- **Root cause**: ResponsiveContainer calculates dimensions before container is sized
- **Solution**: AreaChart component uses inline `style={{ width: '100%', height: 320 }}` on wrapper div to provide explicit dimensions immediately on mount
- **For custom charts**: Always use inline styles for height, not just Tailwind classes

**Issue: Chart renders at 0px height**

- **Solution**: Wrap in container with explicit Tailwind height class (`h-72`, `h-96`, etc.)

**Issue: Chart disappears on hover / "valueFormatter is not a function" error**

- **Root cause**: Astro's `client:only` serialization converts functions to `null`
- **Solution**: Don't pass `valueFormatter`, `onValueChange`, `tooltipCallback`, or `customTooltip` from `.astro` files
- **Workaround**: Create a wrapper React component (`.tsx`) if custom formatting is needed

**Issue: "Encountered two children with the same key" warning**

- **Root cause**: Duplicate `key` props on nested elements within `React.Fragment`
- **Solution**: Only put `key` on `React.Fragment`, not on children `<defs>` or `<linearGradient>`

**Issue: "window is not defined" error**

- **Solution**: Use `client:only="react"` directive (not `client:load`)

**Issue: Hydration mismatch warnings**

- **Solution**: Use `client:only="react"` to skip SSR entirely

**Issue: Charts don't respect dark mode**

- **Solution**: Verify Tremor components use `dark:` prefix classes (should work automatically with `.dark` on `<html>`)

### Adding More Tremor Components

**Copy from official docs:**

1. Visit https://www.tremor.so/docs/components
2. Copy component code
3. Paste into `src/components/tremor/[ComponentName].tsx`
4. Verify imports (`cx`, `chartUtils`, Radix packages)
5. Use with appropriate Astro client directive

**Chart components always need `client:only="react"`**
**UI components (Badge, Button, Select) can use `client:load`**
