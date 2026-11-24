---
name: SiteTab
use when: 'a `SiteTabs` needs the content of one of its tabs'
never when: 'the content is not one of the `tabs` names of an enclosing `SiteTabs`'
subpath: basalt-ui/static
peers: [react]
slots: []
---

# SiteTab

One panel of `SiteTabs`, named by `label`. It renders on its own, so it works as an MDX tag
between the opening and closing `Tabs`.

## Signature

```ts
SiteTab({ label, children, className }: SiteTabProps): ReactElement
  label: string  // The tab this panel belongs to: one of the `tabs` of its `SiteTabs`
  children: ReactNode
  className?: string
```

`SiteTabProps` import from `basalt-ui/static`: `import type { SiteTabProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteTab label="bun">bun add basalt-ui</SiteTab>
```
