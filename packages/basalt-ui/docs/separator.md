---
name: Separator
use when: 'a hairline divides two groups that are not already apart by a gap or a surface'
never when: 'a gap or a Section heading already separates them (a rule on top of it is noise)'
subpath: basalt-ui/ui/separator
peers: ['@base-ui/react']
slots: [separator]
---

# Separator

A hairline between groups, on Base UI so it carries `role="separator"` and its orientation.

## Props

### `Separator`

```ts
Separator({ orientation, className, ...props }: SeparatorProps): ReactElement
  orientation?: "horizontal" | "vertical" | null
  className?: string  // Layout only (`my-4`, `mx-2`)
```

## `separatorVariants`

Part `separator`.

- `orientation`: `horizontal`, `vertical` (default `horizontal`)

## Slots

- `separator`
