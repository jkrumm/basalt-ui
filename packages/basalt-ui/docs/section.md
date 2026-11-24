---
name: Section
use when: 'a page has several parts that each need a heading, their own controls or an anchor'
never when: 'the part is a single card (the card has its own title) or the heading restates the page title'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: []
---

# Section

A titled part of a page: an `h2`, an optional controls slot on the same row and the body. The
section is a named region and a scroll anchor: its `id` is the slug of `title`, and its scroll
margin is `--page-sticky-top`, so a `#hash` jump, a skip link or `scrollIntoView` lands the
heading just below the page band instead of under it. Outside a `Page` the offset is zero.

## Signature

```ts
Section<K extends string = string>(props: SectionProps<K>): ReactElement
  title: string
  summary?: string  // One line beside the title, shown while collapsed too
  controls?: { readonly kind: "controls-slot"; readonly count: number; readonly compact?: boolean; render(): ReactNode; }
  tabs?: PageTabs<K>  // The section's view switch, beside the title
  collapsible?: { defaultOpen?: boolean; state?: ControlHandle<boolean>; }  // The heading is the trigger; open state is uncontrolled or a handle (F2 amendment n5)
  children?: ReactNode
```

`PageTabs`, `SectionProps` import from `basalt-ui/page`: `import type { PageTabs, SectionProps } from 'basalt-ui/page'`.

`ControlHandle` import from `basalt-ui/router`: `import type { ControlHandle } from 'basalt-ui/router'`.

## Example

```tsx
<Section title="Latency" controls={filterSlot([widgetRange])}>
  <ChartCard title="p95" chart={…} />
</Section>
```
