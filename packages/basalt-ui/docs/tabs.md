---
name: Tabs
use when: 'the panels share one page and the reader switches between them in place'
never when: 'the choice changes the page (use InnerNav or a route), or it is a view switch of one figure (use Segmented)'
subpath: basalt-ui/ui/tabs
peers: ['@base-ui/react']
slots: [tabs, tabs-list, tabs-trigger, tabs-content]
---

# Tabs

Tabs on Base UI: roving focus (ArrowLeft and ArrowRight in DOM order, Home and End), Enter or
Space activates, and the panel is linked by `aria-controls`. Works with no provider and renders
no indicator script, so it is safe on a static page.

## Props

### `Tabs`

Tabs on Base UI: roving focus (ArrowLeft and ArrowRight in DOM order, Home and End), Enter or
Space activates, and the panel is linked by `aria-controls`. Works with no provider and renders
no indicator script, so it is safe on a static page.

```ts
Tabs({ size, className, ...props }: TabsProps): ReactElement
  size?: "md" | "sm" | null
  className?: string  // Layout only (`w-full`, `mt-2`, `max-w-md`)
```

### `TabsList`

The row of triggers on a hairline. It scrolls sideways when the triggers outgrow the page, so a
narrow phone never widens the document.

```ts
TabsList({ className, ...props }: TabsListProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`, `max-w-md`)
```

### `TabsTrigger`

One tab. The active tab takes the ink colour and a brand underline; a disabled tab stays
reachable by the arrow keys (it cannot be activated), as the WAI-ARIA tabs pattern asks.

```ts
TabsTrigger({ className, ...props }: TabsTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`, `max-w-md`)
```

### `TabsContent`

The panel of one tab. Only the active panel is mounted unless `keepMounted` is set, which keeps
the state of a form or a scroll position across tab switches.

```ts
TabsContent({ className, ...props }: TabsContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`, `max-w-md`)
```

## `tabsVariants`

Part `tabs`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `tabs`
- `tabs-list`
- `tabs-trigger`
- `tabs-content`
