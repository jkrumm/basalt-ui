import type { ReactElement, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import type { NavTarget } from '../core/ports'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { ArticleProgress } from './article-progress'
import { formatArticleDate } from './core/article-date'
import type { ProseDensity } from './prose'
import { Prose } from './prose'
import type { TocItem } from './toc'
import { Toc } from './toc'

export type ArticleLayoutMeta = {
  title: string
  description?: string
  /** ISO 8601, rendered through `formatArticleDate` (en-US and UTC unless `locale` says otherwise). */
  date?: string
  /** Minutes; rendered as `"N min read"`. */
  readingTime?: number
}

export type ArticleNavTarget = {
  label: string
  /** A route target or a URL; the installed link renders it (`BasaltProvider link`). */
  href: string | NavTarget
  description?: string
}

export type ArticleLayoutProps = {
  /** The article body, typically `Markdown` output or plain HTML. */
  children: ReactNode
  meta?: ArticleLayoutMeta
  /** Scroll-spy TOC collected from the body: a sticky rail in a container of `@wide` (50rem) or more, a popover below. Default `true`. */
  toc?: boolean
  /**
   * The TOC entries (`{ id, label, level }`), when the page knows them (an Astro or MDX page reads
   * them from its headings). They draw in the server HTML, so a static page carries the rail's
   * entries; without them the TOC collects the body's `h2` and `h3` after mount.
   */
  tocItems?: TocItem[]
  /** A thin fixed bar at the top that tracks the scroll through the body. Default `false`. */
  readingProgress?: boolean
  prev?: ArticleNavTarget
  next?: ArticleNavTarget
  /** Overrides how the prev/next cells render. Default: the installed link, a plain `<a>` without one. */
  renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  /** `Prose` density. Default `'article'`. */
  density?: ProseDensity
  /** Locale for `meta.date`. Default `'en-US'`, pinned so server and client print the same string. */
  locale?: string
  /** Layout only (`mt-8`). */
  className?: string
}

function defaultRenderLink(target: ArticleNavTarget, node: ReactNode): ReactNode {
  return <AppLink href={target.href}>{node}</AppLink>
}

function NavCell({
  target,
  side,
  label,
  renderLink,
}: {
  target: ArticleNavTarget
  side: 'prev' | 'next'
  label: string
  renderLink: (target: ArticleNavTarget, node: ReactNode) => ReactNode
}): ReactNode {
  return renderLink(
    target,
    <span className={cn('group flex flex-col gap-1', side === 'next' && 'items-end text-right')}>
      <span className="font-mono text-micro tracking-wider text-faint uppercase">{label}</span>
      <span className="flex items-center gap-1.5 font-head text-md font-medium text-foreground group-hover:text-brand">
        {side === 'prev' && <span aria-hidden="true">←</span>}
        <span>{target.label}</span>
        {side === 'next' && <span aria-hidden="true">→</span>}
      </span>
    </span>,
  )
}

/**
 * The docs-page frame: a centered article column with a title, description, date and reading-time
 * header, an optional scroll-spy TOC, an optional reading-progress bar and a prev/next footer. In a
 * container of `@wide` (50rem) or more the TOC is a sticky right rail; below it an "On this page"
 * button opens the same TOC in a popover. A container query picks the one, so the server HTML is the
 * final layout and a page in static HTML shifts nothing on hydrate. The meta row renders only when
 * `meta.date` or `meta.readingTime` is given.
 *
 * @useWhen a docs or note page needs a title header, a table of contents and prev/next links around its body
 * @neverWhen the page is a dashboard or a form (use Page)
 *
 * @example
 * <ArticleLayout
 *   meta={{ title: 'Reading dashboards', description: '…', date: '2026-07-16', readingTime: 6 }}
 *   readingProgress
 *   next={{ label: 'Chart guide', href: '/guides/charts' }}
 * >
 *   <h2 id="setup">Setup</h2>
 *   <p>…</p>
 * </ArticleLayout>
 */
export function ArticleLayout({
  children,
  meta,
  toc = true,
  tocItems,
  readingProgress = false,
  prev,
  next,
  renderLink = defaultRenderLink,
  density = 'article',
  locale = 'en-US',
  className,
}: ArticleLayoutProps): ReactElement {
  const t = useMessages(page)
  const tocLabel = t('page.tocTrigger')
  const articleRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const [tocOpen, setTocOpen] = useState(false)
  // Crossing into the rail hides the trigger the popover hangs from (it has no box then): close it,
  // so it does not float loose or come back open with no user action.
  useEffect(() => {
    const trigger = triggerRef.current
    if (!tocOpen || trigger === null || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      if (trigger.offsetWidth === 0) setTocOpen(false)
    })
    observer.observe(trigger)
    return () => observer.disconnect()
  }, [tocOpen])
  const hasMetaRow = meta?.date !== undefined || meta?.readingTime !== undefined

  return (
    <>
      {/* outside the container: a container is the containing block of a fixed child */}
      {readingProgress && <ArticleProgress target={articleRef} />}
      <div data-slot="article-layout" className={cn('@container', className)}>
        <div
          className={cn(
            'grid justify-center gap-x-12 grid-cols-[minmax(0,72ch)]',
            toc && '@wide:grid-cols-[minmax(0,72ch)_14rem]',
          )}
        >
          {meta !== undefined && (
            <header className="col-start-1 row-start-1 mb-8 flex flex-col gap-2">
              <h1 className="font-head text-display font-semibold text-balance text-foreground">
                {meta.title}
              </h1>
              {meta.description !== undefined && (
                <p className="text-base text-muted-foreground">{meta.description}</p>
              )}
              {hasMetaRow && (
                <div className="flex items-center gap-2 font-mono text-micro tracking-wider text-faint uppercase">
                  {meta.date !== undefined && <span>{formatArticleDate(meta.date, locale)}</span>}
                  {meta.date !== undefined && meta.readingTime !== undefined && (
                    <span aria-hidden="true">·</span>
                  )}
                  {meta.readingTime !== undefined && (
                    <span>{t('page.minRead', meta.readingTime)}</span>
                  )}
                </div>
              )}
            </header>
          )}

          <div className="col-start-1 row-start-2 min-w-0" ref={articleRef}>
            {toc && (
              <div ref={triggerRef} className="sticky top-2 z-10 flex justify-end @wide:hidden">
                <Popover open={tocOpen} onOpenChange={setTocOpen}>
                  <PopoverTrigger className="relative rounded-ctrl bg-popover px-2 py-1 text-xs font-medium text-muted-foreground shadow-raised after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 hover:text-foreground pointer-coarse:after:min-h-11 forced-colors:border">
                    {tocLabel}
                  </PopoverTrigger>
                  <PopoverContent aria-label={tocLabel} side="bottom" align="end">
                    <Toc
                      containerRef={articleRef}
                      items={tocItems}
                      startAt={tocItems?.[0]?.id}
                      onNavigate={() => setTocOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <Prose density={density}>{children}</Prose>
          </div>

          {toc && (
            <div className="col-start-2 row-start-2 sticky top-6 -m-1 hidden max-h-[calc(100vh-6rem)] self-start overflow-y-auto p-1 @wide:block">
              <Toc containerRef={articleRef} items={tocItems} startAt={tocItems?.[0]?.id} />
            </div>
          )}

          {(prev !== undefined || next !== undefined) && (
            <footer className="col-start-1 row-start-3 mt-12 grid grid-cols-2 gap-4 border-t border-border pt-6 [&_a]:block [&_a]:min-h-11 [&_a]:text-inherit [&_a]:no-underline">
              {prev !== undefined ? (
                <NavCell
                  target={prev}
                  side="prev"
                  label={t('page.previous')}
                  renderLink={renderLink}
                />
              ) : (
                <span />
              )}
              {next !== undefined ? (
                <NavCell target={next} side="next" label={t('page.next')} renderLink={renderLink} />
              ) : (
                <span />
              )}
            </footer>
          )}
        </div>
      </div>
    </>
  )
}
