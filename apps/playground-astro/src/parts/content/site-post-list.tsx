import { SitePostList } from 'basalt-ui/static'
import type { ReactElement } from 'react'

/** Two posts, newest first: a date, a linked title, a description, a byline and tags. */
export function Demo(): ReactElement {
  return (
    <SitePostList
      label="Posts"
      posts={[
        {
          href: '/posts/color-follows-the-scheme',
          title: 'Code colors follow the scheme',
          description: 'Shiki writes both themes; basalt picks one by the scheme attribute.',
          date: '2026-11-18',
          meta: '4 min read',
          tags: ['astro', 'shiki'],
        },
        {
          href: '/posts/the-head-of-an-article',
          title: 'The head of an article',
          description: 'Canonical, Open Graph and structured data from one component.',
          date: '2026-11-10',
          meta: '3 min read',
        },
      ]}
    />
  )
}
