import { SiteHeader } from 'basalt-ui/static'
import type { ReactElement } from 'react'

const PICTURE =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 9%27%3E%3Crect width=%2716%27 height=%279%27 fill=%27%238892a4%27 fill-opacity=%27.4%27/%3E%3C/svg%3E'

/** A bar with a link, a tile menu and a rows menu; the panels are closed, so the static picture is the bar. */
export function Demo(): ReactElement {
  return (
    <SiteHeader
      brand={<a href="/">Basalt UI</a>}
      navLabel="Main"
      menuLabel="Menu"
      links={[
        { href: '/docs', label: 'Docs', current: true },
        {
          label: 'Guides',
          menu: [
            {
              entries: [
                {
                  href: '/guides/content-sites',
                  label: 'Content sites',
                  description: 'Static parts for an Astro page',
                  image: { src: PICTURE, width: 16, height: 9 },
                },
                {
                  href: '/guides/interactive-content',
                  label: 'Interactive content',
                  description: 'Tabs, a table and a form',
                  image: { src: PICTURE, width: 16, height: 9 },
                },
              ],
            },
          ],
        },
        {
          label: 'Tokens',
          menu: [
            {
              entries: [
                { href: '/colors', label: 'Colours', description: 'The derived palette' },
                { href: '/spacing', label: 'Spacing', description: 'The ladder behind every gap' },
              ],
            },
          ],
        },
        { href: '/charts', label: 'Charts' },
      ]}
    />
  )
}
