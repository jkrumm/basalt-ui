---
name: SiteChangelog
use when: 'a site shows what each release changed, from its own data or a parsed CHANGELOG'
never when: 'the page is a single post (use `SiteArticle`), or the history lives in an app screen (use `EventList`)'
subpath: basalt-ui/static
peers: [react]
slots: [changelog]
---

# SiteChangelog

A changelog as static HTML: one anchored article per release with its version, day and grouped
changes; the version column sits beside the notes on a wide container and above them on a narrow one.

## Signature

```ts
SiteChangelog({ releases, locale, headingLevel, className, }: SiteChangelogProps): ReactElement
  releases: readonly SiteRelease[]  // Releases as given, newest first
  locale?: string  // The locale dates read in
  headingLevel?: 2 | 3  // The heading level of each version: 2 under the page's `h1`
  className?: string
```

`SiteChangelogProps`, `SiteRelease` import from `basalt-ui/static`: `import type { SiteChangelogProps, SiteRelease } from 'basalt-ui/static'`.

## Example

```tsx
<SiteChangelog releases={[{ version: '3.1.0', date: '2026-12-01', groups: [{ label: 'Added', items: ['A post list'] }] }]} />
```
