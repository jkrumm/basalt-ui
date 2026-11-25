---
name: Collapsible
use when: 'one region hides and shows behind a trigger (advanced options)'
never when: 'several sections belong together (use Accordion), or the content must stay visible'
subpath: basalt-ui/ui/collapsible
peers: ['@base-ui/react']
slots: [collapsible, collapsible-trigger, collapsible-content]
---

# Collapsible

One show and hide region on Base UI, controlled with `open` or left to `defaultOpen`. Works with
no provider. For a list of sections that belong together use `Accordion`.

## Props

### `Collapsible`

```ts
Collapsible({ className, ...props }: CollapsibleProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `CollapsibleTrigger`

The button that toggles the region. It has no look of its own: it owns focus and the pointer-tier
hit floor, and the caller styles the content (or passes a `Button` through `render`).

```ts
CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `CollapsibleContent`

The region. It animates its height from the measured content and skips the animation under
reduced motion. `hiddenUntilFound` lets the browser's find in page open it on a match;
`keepMounted` keeps it in the DOM while closed so inner state survives.

```ts
CollapsibleContent({ className, ...props }: CollapsibleContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

## Slots

- `collapsible`
- `collapsible-trigger`
- `collapsible-content`
