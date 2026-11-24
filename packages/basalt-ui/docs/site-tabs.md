---
name: SiteTabs
use when: 'an article offers the same content in variants (package managers, languages) and the page ships no client JavaScript'
never when: 'the open tab must follow the URL or drive other parts (use `Tabs` from `basalt-ui/ui/tabs` in an app or an island)'
subpath: basalt-ui/static
peers: [react]
slots: [tabs]
---

# SiteTabs

Tabs as platform markup: a WAI-ARIA tab list and its panels, with no React on the page.
`siteScript()` switches panels on click and with the arrow keys, Home and End, and links each tab
to its panel. Without the script every panel shows under its name. The panels are `SiteTab`s.

## Signature

```ts
SiteTabs({ label, tabs, children, className }: SiteTabsProps): ReactElement
  label: string  // The tab list's accessible name ("Install with")
  tabs: readonly string[]  // The tab names in order; each is the `label` of one `SiteTab` panel
  children: ReactNode  // The `SiteTab` panels, in the order of `tabs`
  className?: string
```

`SiteTabsProps` import from `basalt-ui/static`: `import type { SiteTabsProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteTabs label="Install with" tabs={['bun', 'npm']}>
  <SiteTab label="bun">bun add basalt-ui</SiteTab>
  <SiteTab label="npm">npm i basalt-ui</SiteTab>
</SiteTabs>
```
