---
name: Prose
use when: 'long-form or chat text is rendered as HTML or Markdown and needs the article typography'
never when: 'the content is an app screen made of cards, tables and controls'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [prose]
---

# Prose

The one typography wrapper for long-form content. The `.basalt-prose` sheet styles every element
below it; the density and the measure are set here. `article` (default) is 16px with 1.7 leading;
`chat` is 15px with 1.55. The measure is 72ch unless `measure={false}`.

## Signature

```ts
Prose({ density, measure, children, className, }: ProseProps): ReactElement
  density?: ProseDensity  // Typography density: `'article'` (16px/1.7, default) or `'chat'` (15px/1.55)
  measure?: boolean  // Cap the line length at 72ch
  children: ReactNode
  className?: string  // Layout only (`mt-6`)
```

`ProseProps` import from `basalt-ui/static`: `import type { ProseProps } from 'basalt-ui/static'`.

## Example

```tsx
<Prose>
  <h2 id="reading-dashboards">Reading dashboards</h2>
  <p>Article body…</p>
</Prose>
```
