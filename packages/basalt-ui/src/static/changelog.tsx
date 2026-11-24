import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { formatDay, isoDay } from './dates'
import type { Slot } from './types'

/** What changed in a release, under one heading of your words ("Added", "Fixed"). */
export type SiteReleaseGroup = {
  label: string
  items: readonly Slot[]
}

/** One release of a changelog. */
export type SiteRelease = {
  /** The version as written ("3.1.0"); it names the release's anchor. */
  version: string
  /** The release day (a `Date` or `YYYY-MM-DD`). */
  date: Date | string
  /** The release's page, such as a tag or a GitHub release: the version links there. */
  href?: string
  /** A sentence on the release as a whole. */
  summary?: Slot
  groups: readonly SiteReleaseGroup[]
}

export type SiteChangelogProps = {
  /** Releases as given, newest first. */
  releases: readonly SiteRelease[]
  /** The locale dates read in. Default `en`. */
  locale?: string
  /** The heading level of each version: 2 under the page's `h1`. Default 2. */
  headingLevel?: 2 | 3
  className?: string
}

/** The anchor of a release: `release-3-1-0`. */
function releaseId(version: string): string {
  return `release-${version.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`
}

/**
 * A changelog as static HTML: one anchored article per release with its version, day and grouped
 * changes; the version column sits beside the notes on a wide container and above them on a narrow one.
 *
 * @useWhen a site shows what each release changed, from its own data or a parsed CHANGELOG
 * @neverWhen the page is a single post (use `SiteArticle`), or the history lives in an app screen (use `EventList`)
 *
 * @example
 * <SiteChangelog releases={[{ version: '3.1.0', date: '2026-12-01', groups: [{ label: 'Added', items: ['A post list'] }] }]} />
 */
export function SiteChangelog({
  releases,
  locale,
  headingLevel = 2,
  className,
}: SiteChangelogProps): ReactElement {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const Group = headingLevel === 2 ? 'h3' : 'h4'
  return (
    <div data-slot="changelog" className={cn('@container', className)}>
      <div className="flex flex-col divide-y divide-border">
        {releases.map((release) => (
          <article
            key={release.version}
            id={releaseId(release.version)}
            className="grid scroll-mt-20 grid-cols-1 gap-x-10 gap-y-3 py-8 first:pt-0 last:pb-0 @wide:grid-cols-[10rem_minmax(0,1fr)]"
          >
            <header className="flex flex-col gap-1 @wide:sticky @wide:top-20 @wide:self-start">
              <Heading className="m-0 font-head text-xl font-semibold text-foreground">
                {release.href === undefined ? (
                  release.version
                ) : (
                  <a
                    href={release.href}
                    className="focus-ring rounded-sm text-inherit no-underline hover:underline"
                  >
                    {release.version}
                  </a>
                )}
              </Heading>
              <time dateTime={isoDay(release.date)} className="font-mono text-xs text-faint">
                {formatDay(release.date, locale)}
              </time>
            </header>
            <div className="flex min-w-0 flex-col gap-4">
              {release.summary !== undefined && (
                <p className="m-0 max-w-[60ch] text-muted-foreground">{release.summary}</p>
              )}
              {release.groups.map((group) => (
                <section key={group.label} className="flex flex-col gap-1.5">
                  <Group className="m-0 font-mono text-micro tracking-wider text-faint uppercase">
                    {group.label}
                  </Group>
                  <ul className="m-0 flex list-disc flex-col gap-1 ps-5 marker:text-faint">
                    {group.items.map((item, i) => (
                      <li key={i} className="max-w-[70ch] text-foreground">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
