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
 *     meta="6 min read · guide"
 *     href="/content"
 *     renderLink={(target, node) => <Link to={target.href}>{node}</Link>}
 *   />
 * </ArticleGrid>
 */
import type { CSSProperties, ReactNode } from 'react'
import { Card, SimpleGrid } from '@mantine/core'
import classes from './article-card.module.css'
import type { ArticleNavTarget } from './article-layout'

export type ArticleCardProps = {
  readonly title: string
  readonly description?: string
  readonly icon?: ReactNode
  /** Preformatted meta string, e.g. `'6 min read · guide'`. */
  readonly meta?: string
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
  meta,
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

  const body = (
    <>
      {icon !== undefined && <span className={classes.icon}>{icon}</span>}
      <span className={classes.title}>{title}</span>
      {description !== undefined && <span className={classes.description}>{description}</span>}
      {meta !== undefined && <span className={classes.meta}>{meta}</span>}
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
