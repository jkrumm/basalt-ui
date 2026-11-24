---
name: SiteCallToAction
use when: 'a landing page or a guide ends by asking the reader to start'
never when: 'the ask belongs inside the text (use a link in the prose)'
subpath: basalt-ui/static
peers: [react]
slots: [site-call-to-action]
---

# SiteCallToAction

A full-width band that closes a page with one ask: a heading, a line and the actions. From the
`wide` size the actions sit at the end of the row, below it under the text.

## Signature

```ts
SiteCallToAction({ title, description, actions, className, }: SiteCallToActionProps): ReactElement
  title: ReactNode  // The band's `h2`
  description?: ReactNode
  actions: readonly SiteAction[]  // The calls to action, as links; at most one `primary`
  className?: string
```

`SiteAction` import from `basalt-ui/static`: `import type { SiteAction } from 'basalt-ui/static'`.

## Example

```tsx
<SiteCallToAction title="Start in one command" actions={[{ href: '/docs', label: 'Read the docs', primary: true }]} />
```
