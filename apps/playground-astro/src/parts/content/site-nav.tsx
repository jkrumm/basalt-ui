import { SiteNav } from 'basalt-ui/static'
import type { ReactElement } from 'react'

/** A guides sidebar: a titled group with the current page marked and a nested chapter. */
export function Demo(): ReactElement {
  return (
    <div className="w-64">
      <SiteNav
        groups={[
          {
            title: 'Guides',
            links: [
              { href: '/guides/setup', label: 'Set up the site', current: true },
              { href: '/guides/write', label: 'Write a guide' },
              {
                label: 'Reference',
                items: [
                  { href: '/guides/head', label: 'The head' },
                  { href: '/guides/code', label: 'Code colors' },
                ],
              },
            ],
          },
        ]}
      />
    </div>
  )
}
