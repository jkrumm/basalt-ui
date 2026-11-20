import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { TocEntry } from './types'

export type SiteTocProps = {
  entries: readonly TocEntry[]
  /** The list's heading and the landmark's accessible name ("On this page"). */
  label: string
  /** The deepest level listed. Default 3. */
  maxLevel?: number
  className?: string
}

/** The entries a TOC lists: level 2 up to `maxLevel`. */
export function tocEntries(entries: readonly TocEntry[], maxLevel = 3): TocEntry[] {
  return entries.filter((e) => e.level >= 2 && e.level <= maxLevel)
}

/**
 * An on-this-page list of in-page links, from entries the host already has (Astro's `headings`,
 * a remark plugin's output). Static: the browser's own anchor jump moves the reader, nothing
 * tracks the scroll. Internal: `SiteArticle` renders it from its `toc` prop; it stays unexported until a
 * page needs the list outside an article.
 */
export function SiteToc({
  entries,
  label,
  maxLevel = 3,
  className,
}: SiteTocProps): ReactElement | null {
  const listed = tocEntries(entries, maxLevel)
  if (listed.length === 0) return null
  return (
    <nav data-slot="toc" aria-label={label} className={cn('flex flex-col gap-2', className)}>
      <p className="font-mono text-micro tracking-wider text-faint uppercase">{label}</p>
      <TocList entries={listed} />
    </nav>
  )
}

export function TocList({ entries }: { entries: readonly TocEntry[] }): ReactElement {
  return (
    <ul className="flex flex-col border-s border-border">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className={cn(
              'focus-ring -ms-px block border-s border-transparent py-1 ps-3 text-sm text-muted-foreground no-underline hover:border-foreground hover:text-foreground',
              entry.level >= 3 && 'ps-6',
            )}
          >
            {entry.label}
          </a>
        </li>
      ))}
    </ul>
  )
}
