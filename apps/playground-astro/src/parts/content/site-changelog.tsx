import { SiteChangelog } from 'basalt-ui/static'
import type { ReactElement } from 'react'

/** Two releases: version, day, a summary and the changes grouped under the site's own words. */
export function Demo(): ReactElement {
  return (
    <SiteChangelog
      releases={[
        {
          version: '1.2.0',
          date: '2026-11-20',
          summary: 'Posts get an article head and a list page.',
          groups: [
            { label: 'Added', items: ['A post list, newest first', 'Open Graph for every post'] },
            { label: 'Fixed', items: ['The sidebar marks the current guide'] },
          ],
        },
        {
          version: '1.1.0',
          date: '2026-10-02',
          groups: [{ label: 'Added', items: ['Guides in one collection with a pager'] }],
        },
      ]}
    />
  )
}
