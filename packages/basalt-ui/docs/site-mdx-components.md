---
name: siteMdxComponents
use when: 'authored MDX renders on a content page that ships no client JavaScript'
never when: 'the MDX needs parts that share state or a provider (use `mdxComponents` from `basalt-ui/page` in an app)'
subpath: basalt-ui/static
peers: [react]
slots: []
---

# siteMdxComponents

The MDX component map for static pages: anchored `h2`-`h4`, `a` through the url policy, a
scrolling `table`, every fenced block in a `SiteCodeBlock` with a copy button, and `SiteCallout`,
`Steps`, `Step`, `Figure`, `Tabs` and `Tab`, and `Form`, `Field` and `SubmitButton` for the tags an
author writes. Nothing in it hydrates; the copy button and the tabs need `siteScript()`. A sortable
table and a chart are islands: add `basalt-ui/astro/mdx/DataTable.astro` and `Chart.astro` as the
`DataTable` and `Chart` entries. Pass the result as the compiled module's `components` inside
`Prose`. The words come from `labels`; none is baked in.

## Signature

```ts
siteMdxComponents(labels: SiteMdxLabels): Readonly<Record<string, ComponentType<never>>>
  copyLabel: string  // The code blocks' copy button name ("Copy code")
  copiedLabel: string  // Announced after a copy ("Copied")
```

`SiteMdxLabels` import from `basalt-ui/static`: `import type { SiteMdxLabels } from 'basalt-ui/static'`.

## Example

```tsx
const components = siteMdxComponents({ copyLabel: 'Copy code', copiedLabel: 'Copied' })
<Prose><Content components={components} /></Prose>
```
