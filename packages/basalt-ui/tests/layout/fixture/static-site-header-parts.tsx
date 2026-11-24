import type { ReactElement } from 'react'
import { SiteHeader } from '../../../src/static'

const IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 9%27%3E%3Crect width=%2716%27 height=%279%27 fill=%27%23888%27/%3E%3C/svg%3E'

/** A header with a plain link, a tile menu, a rows menu and a link after them. */
export function Parts({ menus = true }: { menus?: boolean }): ReactElement {
  return (
    <>
      <SiteHeader
        brand={<a href="/">Basalt</a>}
        navLabel="Main"
        menuLabel="Menu"
        actions={<a href="/repo">Repository</a>}
        links={[
          { href: '/docs', label: 'Docs', current: true },
          ...(menus
            ? [
                {
                  label: 'Product',
                  menu: [
                    {
                      entries: [
                        {
                          href: '/charts',
                          label: 'Charts',
                          description: 'Marks that read at a glance',
                          image: { src: IMAGE, width: 16, height: 9 },
                        },
                        {
                          href: '/tables',
                          label: 'Tables',
                          description: 'Dense and keyboard first',
                          image: { src: IMAGE, width: 16, height: 9 },
                        },
                        {
                          href: '/shell',
                          label: 'Shell',
                          description: 'Rail, header and page',
                          image: { src: IMAGE, width: 16, height: 9 },
                        },
                      ],
                    },
                  ],
                },
                {
                  label: 'Resources',
                  menu: [
                    {
                      title: 'Learn',
                      entries: [
                        {
                          href: '/guides',
                          label: 'Guides',
                          description: 'Build a page step by step',
                        },
                        { href: '/recipes', label: 'Recipes' },
                      ],
                    },
                    {
                      title: 'Project',
                      entries: [
                        { href: '/changelog', label: 'Changelog', description: 'What shipped' },
                      ],
                    },
                  ],
                },
              ]
            : []),
          { href: '/about', label: 'About' },
        ]}
      />
      <main className="p-6 text-foreground">
        <h1 className="text-lg font-semibold">Page</h1>
        <p>Body text under the header.</p>
      </main>
    </>
  )
}
