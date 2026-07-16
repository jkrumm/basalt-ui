/**
 * ArticleCard / ArticleGrid — the docs-landing overview building blocks (docs/CONTENT-SPEC.md
 * §3/§7): an icon/title/description/meta card over the shipped `Card` chrome, and the responsive
 * grid that lays a set of them out.
 *
 * `ArticleCard` is clickable three ways — pick whichever fits: `href` alone renders the `Card`
 * itself as an anchor; `href` + `renderLink` hands the card to a router bridge (e.g. TanStack
 * `Link`); `onClick` alone renders a keyboard-operable button-role card. Omit all three for a
 * static, non-interactive card.
 *
 * @example
 * import { ArticleCard, ArticleGrid } from 'basalt-ui/content'
 * import { Link } from '@tanstack/react-router'
 *
 * <ArticleGrid>
 *   <ArticleCard
 *     title="Reading dashboards"
 *     description="Why most internal dashboards fail the five-second glance test."
 *     date="2026-07-16"
 *     readingTime={6}
 *     category="guide"
 *     tags={['dashboards', 'ux']}
 *     href="/content"
 *     renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
 *   />
 * </ArticleGrid>
 */
import type { CSSProperties, ReactNode } from 'react'
import { Card, SimpleGrid } from '@mantine/core'
import classes from './article-card.module.css'
import { formatArticleDate } from './article-model'
import type { ArticleNavTarget } from './article-layout'

export type ArticleCardProps = {
  readonly title: string
  readonly description?: string
  readonly icon?: ReactNode
  /** ISO 8601 — rendered via `formatArticleDate`. */
  readonly date?: string
  readonly category?: string
  readonly tags?: readonly string[]
  /** Minutes; rendered as `"N min read"`. */
  readonly readingTime?: number
  /** Locale passed to `formatArticleDate`. Default `'en-US'` — see its JSDoc for why this is
   * pinned rather than defaulting to the runtime locale. */
  readonly locale?: string
  readonly href?: string
  /** Router bridge — when given alongside `href`, the card is handed to it instead of rendering a
   * plain anchor itself. */
  readonly renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  readonly onClick?: () => void
  readonly className?: string
  readonly style?: CSSProperties
}

const CARD_STYLE: CSSProperties = {
  padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
}

export function ArticleCard({
  title,
  description,
  icon,
  date,
  category,
  tags,
  readingTime,
  locale = 'en-US',
  href,
  renderLink,
  onClick,
  className,
  style,
}: ArticleCardProps) {
  const cardClass = [
    classes.card,
    (href !== undefined || onClick !== undefined) && classes.clickable,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const mergedStyle: CSSProperties = { ...CARD_STYLE, ...style }

  // Derived, not passed in — the card owns the meta line's shape so callers hand it structured
  // fields instead of a preformatted string.
  const meta = [
    date !== undefined ? formatArticleDate(date, locale) : undefined,
    readingTime !== undefined ? `${readingTime} min read` : undefined,
    category,
  ]
    .filter((part) => part !== undefined)
    .join(' · ')

  const body = (
    <>
      {icon !== undefined && <span className={classes.icon}>{icon}</span>}
      <span className={classes.title}>{title}</span>
      {description !== undefined && <span className={classes.description}>{description}</span>}
      {tags !== undefined && tags.length > 0 && (
        <span className={classes.tags}>
          {tags.map((tag) => (
            <span key={tag} className={classes.tag}>
              {tag}
            </span>
          ))}
        </span>
      )}
      {meta !== '' && <span className={classes.meta}>{meta}</span>}
    </>
  )

  if (href !== undefined && renderLink !== undefined) {
    const target: ArticleNavTarget = {
      label: title,
      href,
      ...(description !== undefined && { description }),
    }
    // The router bridge renders its own anchor around the card — the wrapper class neutralizes
    // browser anchor defaults (underline, link color) the library can't reach from inside.
    return (
      <span className={classes.linkWrap}>
        {renderLink(
          target,
          <Card className={cardClass} style={mergedStyle}>
            {body}
          </Card>,
        )}
      </span>
    )
  }

  if (href !== undefined) {
    return (
      <Card component="a" href={href} className={cardClass} style={mergedStyle}>
        {body}
      </Card>
    )
  }

  if (onClick !== undefined) {
    return (
      <Card
        component="button"
        type="button"
        onClick={onClick}
        className={cardClass}
        style={mergedStyle}
      >
        {body}
      </Card>
    )
  }

  return (
    <Card className={cardClass} style={mergedStyle}>
      {body}
    </Card>
  )
}

export type ArticleGridProps = {
  readonly children: ReactNode
  /** Columns at the `lg` breakpoint. Default `3`. */
  readonly cols?: number
}

export function ArticleGrid({ children, cols = 3 }: ArticleGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: cols }} spacing="sm">
      {children}
    </SimpleGrid>
  )
}
