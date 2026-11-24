import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { formatDay, isoDay } from './dates'

/** One entry of a post list: what a content collection yields for a guide, article or post. */
export type SitePost = {
  href: string
  title: string
  /** The one or two lines under the title. */
  description?: string
  /** The day it was published (a `Date` or `YYYY-MM-DD`). */
  date?: Date | string
  /** Your words for the rest of the byline: "4 min read", an author. */
  meta?: string
  /** Topics, as the site names them. */
  tags?: readonly string[]
}

export type SitePostListProps = {
  posts: readonly SitePost[]
  /** The list's accessible name ("Guides"). */
  label: string
  /** The locale dates read in. Default `en`. */
  locale?: string
  /** The heading level of each title: 2 under the page's `h1`, 3 under a section heading. Default 2. */
  headingLevel?: 2 | 3
  className?: string
}

/**
 * A list of posts, newest first as given: a date, a linked title, a description and a byline per row.
 * Static: the whole row is one link target through its title, nothing hydrates.
 *
 * @useWhen a site lists its guides, articles or posts on an index page
 * @neverWhen the rows are app records (use `DataTable` or `RowList`), or the list is a header menu (use `SiteHeader`)
 *
 * @example
 * <SitePostList label="Guides" posts={[{ href: '/guides/setup', title: 'Setup', date: '2026-11-20', meta: '4 min read' }]} />
 */
export function SitePostList({
  posts,
  label,
  locale,
  headingLevel = 2,
  className,
}: SitePostListProps): ReactElement {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <ul
      data-slot="post-list"
      aria-label={label}
      className={cn('m-0 flex list-none flex-col divide-y divide-border p-0', className)}
    >
      {posts.map((post) => (
        <li key={post.href} className="flex flex-col gap-1.5 py-6 first:pt-0 last:pb-0">
          {(post.date !== undefined || post.meta !== undefined) && (
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-faint">
              {post.date !== undefined && (
                <time dateTime={isoDay(post.date)}>{formatDay(post.date, locale)}</time>
              )}
              {post.meta !== undefined && <span>{post.meta}</span>}
            </p>
          )}
          <Heading className="m-0 font-head text-xl font-semibold text-balance text-foreground">
            <a
              href={post.href}
              className="focus-ring rounded-sm text-inherit no-underline hover:underline"
            >
              {post.title}
            </a>
          </Heading>
          {post.description !== undefined && (
            <p className="m-0 max-w-[60ch] text-muted-foreground">{post.description}</p>
          )}
          {post.tags !== undefined && post.tags.length > 0 && (
            <ul className="m-0 mt-1 flex list-none flex-wrap gap-1.5 p-0">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-chip bg-card px-2 py-0.5 font-mono text-micro text-muted-foreground ring-1 ring-border"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
