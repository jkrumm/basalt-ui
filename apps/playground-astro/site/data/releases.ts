import type { SiteRelease } from 'basalt-ui/static'

/** Newest first. A real site parses its CHANGELOG or reads a collection; the part takes the rows either way. */
export const RELEASES: readonly SiteRelease[] = [
  {
    version: '1.2.0',
    date: '2026-11-20',
    href: 'https://example.com/releases/1.2.0',
    summary: 'Posts get an article head and a list page.',
    groups: [
      {
        label: 'Added',
        items: ['A post list, newest first', 'Open Graph and JSON-LD for every post'],
      },
      { label: 'Fixed', items: ['The sidebar marks the current guide'] },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-02',
    groups: [{ label: 'Added', items: ['Guides in one collection with a pager'] }],
  },
  {
    version: '1.0.0',
    date: '2026-09-01',
    summary: 'The first release.',
    groups: [{ label: 'Added', items: ['A landing page and a changelog'] }],
  },
]
