/**
 * ArticleLayout — the docs-page frame (docs/CONTENT-SPEC.md §3/§7): a centered content column, an
 * optional sticky scroll-spy TOC rail, a title/description/date/reading-time meta header, and a
 * prev/next pagination footer. Composes stage 1/2 primitives (`Prose`, `TableOfContents`,
 * `ReadingProgress`) — it does not reimplement them.
 *
 * The header/content/footer all align to the SAME grid column, so the article body reads as one
 * consistent width whether or not the TOC rail is visible. Below the 1200px breakpoint the rail
 * is replaced, not dropped: a sticky "On this page" trigger opens the same `TableOfContents` in a
 * `Popover` (docs/CONTENT-SPEC.md §7's originally-documented behavior, `useSizeClass() !==
 * 'expanded'` — the same numeric threshold, resolved in JS instead of `@media`).
 *
 * @example
 * import { ArticleLayout } from 'basalt-ui/content'
 * import { Link } from '@tanstack/react-router'
 *
 * <ArticleLayout
 *   meta={{ title: 'Reading dashboards', description: '…', date: '2026-07-16', readingTime: 6 }}
 *   readingProgress
 *   next={{ label: 'Chart guide', href: '/guides/charts' }}
 *   renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
 * >
 *   <h2 id="setup">Setup</h2>
 *   <p>…</p>
 * </ArticleLayout>
 */
import type { CSSProperties, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { Button, Popover, ScrollArea } from '@mantine/core'
import { useSizeClass } from '../shell/use-size-class'
import classes from './article-layout.module.css'
import { formatArticleDate } from './article-model'
import type { ProseDensity } from './prose'
import { Prose } from './prose'
import { ReadingProgress } from './reading-progress'
import { TableOfContents } from './toc'

export type ArticleLayoutMeta = {
  readonly title: string
  readonly description?: string
  /** ISO 8601 — rendered via `formatArticleDate`. No date library: `Intl` is a native API. */
  readonly date?: string
  /** Minutes; rendered as `"N min read"`. */
  readonly readingTime?: number
}

export type ArticleNavTarget = {
  readonly label: string
  readonly href: string
  readonly description?: string
}

export type ArticleLayoutProps = {
  /** The article body — typically `Prose`/`Markdown`/`MDXContent` output. */
  readonly children: ReactNode
  readonly meta?: ArticleLayoutMeta
  /** Sticky scroll-spy TOC rail, auto-collected from the article body. Default `true`. */
  readonly toc?: boolean
  /** Scroll-driven top progress bar tracking the article body. Default `false` (opt-in). */
  readonly readingProgress?: boolean
  readonly prev?: ArticleNavTarget
  readonly next?: ArticleNavTarget
  /** Router bridge for the prev/next footer cells. Default renders a plain `<a href>`. */
  readonly renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  /** `Prose` density passthrough. Default `'article'`. */
  readonly density?: ProseDensity
  /** Locale passed to `formatArticleDate` for `meta.date`. Default `'en-US'` — see its JSDoc for
   * why this is pinned rather than defaulting to the runtime locale. */
  readonly locale?: string
  readonly className?: string
  readonly style?: CSSProperties
}

function defaultRenderLink(target: ArticleNavTarget, node: ReactNode): ReactNode {
  return <a href={target.href}>{node}</a>
}

function NavCell({
  target,
  side,
  renderLink,
}: {
  readonly target: ArticleNavTarget
  readonly side: 'prev' | 'next'
  readonly renderLink: (target: ArticleNavTarget, node: ReactNode) => ReactNode
}) {
  const arrow = side === 'prev' ? '←' : '→'
  const cellClass = [classes.navCell, side === 'next' && classes.navCellNext]
    .filter(Boolean)
    .join(' ')

  return renderLink(
    target,
    <span className={cellClass}>
      <span className={classes.navLabel}>{side === 'prev' ? 'Previous' : 'Next'}</span>
      <span className={classes.navTarget}>
        {side === 'prev' && <span aria-hidden>{arrow}</span>}
        <span>{target.label}</span>
        {side === 'next' && <span aria-hidden>{arrow}</span>}
      </span>
    </span>,
  )
}

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
  style,
}: ArticleLayoutProps) {
  const articleRef = useRef<HTMLDivElement>(null)
  const rootClass = [classes.root, !toc && classes.noToc, className].filter(Boolean).join(' ')
  const hasMetaRow = meta?.date !== undefined || meta?.readingTime !== undefined
  // `useSizeClass()` is the JS-side twin of the `@media (max-width: 1200px)` rule below — both read
  // `BREAKPOINTS.article`/`SIZE_CLASSES.expanded`, the same 1200 number (`article-layout.module.css`'s
  // own comment). Below it the rail is replaced by a trigger, never both at once — a CSS-only swap
  // has no hook to open a `Popover` from, so this is one of the JS reads that breakpoint doctrine
  // reserves `useSizeClass()` for, not a second raw media query.
  const showTocRail = useSizeClass() === 'expanded'
  const [tocOpen, setTocOpen] = useState(false)
  // Resizing across the breakpoint unmounts the `Popover` without closing it — `tocOpen` lives on
  // THIS component, not the Popover, so crossing back below the breakpoint would otherwise remount
  // it already open with no user action. Adjusted during render (React's own pattern for resetting
  // state when a derived value changes), not an effect, so there is no open-then-close flash.
  const prevShowTocRailRef = useRef(showTocRail)
  if (prevShowTocRailRef.current !== showTocRail) {
    prevShowTocRailRef.current = showTocRail
    if (tocOpen) setTocOpen(false)
  }

  return (
    <div className={rootClass} {...(style !== undefined && { style })}>
      {readingProgress && <ReadingProgress target={articleRef} />}

      {meta !== undefined && (
        <header className={classes.header}>
          <h1 className={classes.title}>{meta.title}</h1>
          {meta.description !== undefined && (
            <p className={classes.description}>{meta.description}</p>
          )}
          {hasMetaRow && (
            <div className={classes.metaRow}>
              {meta.date !== undefined && <span>{formatArticleDate(meta.date, locale)}</span>}
              {meta.date !== undefined && meta.readingTime !== undefined && <span>·</span>}
              {meta.readingTime !== undefined && <span>{meta.readingTime} min read</span>}
            </div>
          )}
        </header>
      )}

      <div className={classes.content} ref={articleRef}>
        <Prose density={density}>{children}</Prose>
      </div>

      {toc && showTocRail && (
        <div className={classes.tocRail}>
          <ScrollArea.Autosize mah="calc(100vh - 108px)" type="hover">
            <TableOfContents containerRef={articleRef} />
          </ScrollArea.Autosize>
        </div>
      )}

      {toc &&
        !showTocRail && (
          // `.tocTrigger`'s `grid-row: 2` (article-layout.module.css) is EXPLICIT, matching
          // `.content`'s own row — not left to CSS Grid's auto-placement, which used to land this
          // in its own row below the content instead of at its top (both are `grid-column: 1`, and
          // the auto-placement cursor moves past row 2 once `.content` claims it).
          <Popover
            opened={tocOpen}
            onChange={setTocOpen}
            onDismiss={() => setTocOpen(false)}
            position="bottom-end"
            withinPortal
            shadow="md"
            radius="sm"
            trapFocus
          >
            <Popover.Target>
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                className={classes.tocTrigger}
                classNames={{ label: classes.tocTriggerLabel }}
                onClick={() => setTocOpen((current) => !current)}
              >
                On this page
              </Button>
            </Popover.Target>
            <Popover.Dropdown className={classes.tocDropdown}>
              <ScrollArea.Autosize mah="calc(100vh - 108px)" type="hover">
                <TableOfContents containerRef={articleRef} onNavigate={() => setTocOpen(false)} />
              </ScrollArea.Autosize>
            </Popover.Dropdown>
          </Popover>
        )}

      {(prev !== undefined || next !== undefined) && (
        <footer className={classes.footer}>
          {prev !== undefined ? (
            <NavCell target={prev} side="prev" renderLink={renderLink} />
          ) : (
            <span />
          )}
          {next !== undefined ? (
            <NavCell target={next} side="next" renderLink={renderLink} />
          ) : (
            <span />
          )}
        </footer>
      )}
    </div>
  )
}
