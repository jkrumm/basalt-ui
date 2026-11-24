---
name: SitePostList
use when: 'a site lists its guides, articles or posts on an index page'
never when: 'the rows are app records (use `DataTable` or `RowList`), or the list is a header menu (use `SiteHeader`)'
subpath: basalt-ui/static
peers: [react]
slots: [post-list]
---

# SitePostList

A list of posts, newest first as given: a date, a linked title, a description and a byline per row.
Static: the whole row is one link target through its title, nothing hydrates.

## Signature

```ts
SitePostList({ posts, label, locale, headingLevel, className, }: SitePostListProps): ReactElement
  posts: readonly SitePost[]
  label: string  // The list's accessible name ("Guides")
  locale?: string  // The locale dates read in
  headingLevel?: 2 | 3  // The heading level of each title: 2 under the page's `h1`, 3 under a section heading
  className?: string
```

`SitePost`, `SitePostListProps` import from `basalt-ui/static`: `import type { SitePost, SitePostListProps } from 'basalt-ui/static'`.

## Example

```tsx
<SitePostList label="Guides" posts={[{ href: '/guides/setup', title: 'Setup', date: '2026-11-20', meta: '4 min read' }]} />
```
