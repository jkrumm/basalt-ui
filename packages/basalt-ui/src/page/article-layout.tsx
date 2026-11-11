import type { ReactElement, ReactNode } from 'react'
import { useRef, useState, useSyncExternalStore } from 'react'
import { cn } from '../core/cn'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { ArticleProgress } from './article-progress'
import { formatArticleDate } from './core/article-date'
import type { ProseDensity } from './prose'
import { Prose } from './prose'
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
  href: string
  description?: string
}

export type ArticleLayoutProps = {
  /** The article body, typically `Markdown` output or plain HTML. */
  children: ReactNode
  meta?: ArticleLayoutMeta
  /** Scroll-spy TOC collected from the body: a sticky rail from 1200px, a popover below. Default `true`. */
  toc?: boolean
  /** A thin fixed bar at the top that tracks the scroll through the body. Default `false`. */
  readingProgress?: boolean
  prev?: ArticleNavTarget
  next?: ArticleNavTarget
  /** Router bridge for the prev/next cells. Default renders a plain `<a href>`. */
  renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  /** `Prose` density. Default `'article'`. */
  density?: ProseDensity
  /** Locale for `meta.date`. Default `'en-US'`, pinned so server and client print the same string. */
  locale?: string
  /** Layout only (`mt-8`). */
  className?: string
}

/** The `xl` breakpoint (`--breakpoint-xl` in `css/tailwind.css`): the rail shows from this width. */
const RAIL_QUERY = '(min-width: 1200px)'

function subscribeRail(onChange: () => void): () => void {
  // theme-allow raw-breakpoint — the TOC swap needs one of two branches mounted, not both hidden by CSS
  const list = window.matchMedia(RAIL_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

// theme-allow raw-breakpoint — the same TOC swap read
const railSnapshot = (): boolean => window.matchMedia(RAIL_QUERY).matches
// Below the breakpoint until the client says otherwise: the trigger is the safe first paint.
const railServerSnapshot = (): boolean => false

function defaultRenderLink(target: ArticleNavTarget, node: ReactNode): ReactNode {
  return <a href={target.href}>{node}</a>
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
 * header, an optional scroll-spy TOC, an optional reading-progress bar and a prev/next footer. From
 * 1200px the TOC is a sticky right rail; below it an "On this page" button opens the same TOC in a
 * popover. The meta row renders only when `meta.date` or `meta.readingTime` is given.
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
  const wide = useSyncExternalStore(subscribeRail, railSnapshot, railServerSnapshot)
  const showRail = toc && wide
  const [tocOpen, setTocOpen] = useState(false)
  // Crossing the breakpoint unmounts the popover without closing it; reset during render so it does
  // not come back open with no user action.
  const [prevWide, setPrevWide] = useState(wide)
  if (prevWide !== wide) {
    setPrevWide(wide)
    if (tocOpen) setTocOpen(false)
  }
  const hasMetaRow = meta?.date !== undefined || meta?.readingTime !== undefined

  return (
    <div
      data-slot="article-layout"
      className={cn(
        'grid justify-center gap-x-12 grid-cols-[minmax(0,72ch)]',
        showRail && 'grid-cols-[minmax(0,72ch)_14rem]',
        className,
      )}
    >
      {readingProgress && <ArticleProgress target={articleRef} />}

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
              {meta.readingTime !== undefined && <span>{t('page.minRead', meta.readingTime)}</span>}
            </div>
          )}
        </header>
      )}

      <div className="col-start-1 row-start-2 min-w-0" ref={articleRef}>
        {toc && !wide && (
          <div className="sticky top-2 z-10 flex justify-end">
            <Popover open={tocOpen} onOpenChange={setTocOpen}>
              <PopoverTrigger className="rounded-ctrl bg-popover px-2 py-1 text-xs font-medium text-muted-foreground shadow-raised hover:text-foreground">
                {tocLabel}
              </PopoverTrigger>
              <PopoverContent aria-label={tocLabel} side="bottom" align="end">
                <Toc containerRef={articleRef} onNavigate={() => setTocOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
        )}
        <Prose density={density}>{children}</Prose>
      </div>

      {showRail && (
        <div className="col-start-2 row-start-2 sticky top-6 max-h-[calc(100vh-6rem)] self-start overflow-y-auto">
          <Toc containerRef={articleRef} />
        </div>
      )}

      {(prev !== undefined || next !== undefined) && (
        <footer className="col-start-1 row-start-3 mt-12 grid grid-cols-2 gap-4 border-t border-border pt-6 [&_a]:text-inherit [&_a]:no-underline">
          {prev !== undefined ? (
            <NavCell target={prev} side="prev" label={t('page.previous')} renderLink={renderLink} />
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
  )
}
