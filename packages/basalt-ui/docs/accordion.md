---
name: Accordion
use when: 'several sections belong together and the reader opens the ones they need'
never when: 'one region alone (use Collapsible), or the content must stay visible (use Section)'
subpath: basalt-ui/ui/accordion
peers: ['@base-ui/react']
slots: [accordion, accordion-item, accordion-trigger, accordion-content]
---

# Accordion

A stack of disclosure sections on Base UI: one trigger per item, one item open at a time unless
`multiple` is set. Works with no provider.

## Props

### `Accordion`

```ts
Accordion<Value = unknown>({ className, ...props }: AccordionProps<Value>): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-md`, `mt-4`)
```

### `AccordionItem`

One section: a trigger and its panel, closed from the next section by a hairline.

```ts
AccordionItem({ className, ...props }: AccordionItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-md`, `mt-4`)
```

### `AccordionTrigger`

The button that opens an item, inside the item's heading. The chevron turns while the panel is
open. A coarse pointer lifts the row to the 44 px floor.

```ts
AccordionTrigger({ className, children, ...props }: AccordionTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-md`, `mt-4`)
```

### `AccordionContent`

The panel of an item. It animates its height from the measured content and skips the animation
under reduced motion. `hiddenUntilFound` and `keepMounted` can be set here per item, or once on
`Accordion`.

```ts
AccordionContent({ className, children, ...props }: AccordionContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-md`, `mt-4`)
```

## Slots

- `accordion`
- `accordion-item`
- `accordion-trigger`
- `accordion-content`
