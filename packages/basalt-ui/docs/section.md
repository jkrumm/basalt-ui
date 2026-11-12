---
name: Section
use when: 'a page has several parts that each need a heading, their own controls or an anchor'
never when: 'the part is a single card (the card has its own title) or the heading restates the page title'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [section, section-controls]
---

# Section

A titled part of a page: an `h2`, an optional controls slot on the same row and the body. The
section is a named region and a scroll anchor: its `id` is the slug of `title`, and its scroll
margin is `--page-sticky-top`, so a `#hash` jump, a skip link or `scrollIntoView` lands the
heading just below the page band instead of under it. Outside a `Page` the offset is zero.

## Signature

```ts
Section({ title, controls, children }: SectionProps): ReactElement
  title: string
  controls?: ControlsSlot
  children?: ReactNode
```
