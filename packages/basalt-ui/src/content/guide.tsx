/**
 * GuideDrawer / GuideLink — contextual in-app help (docs/CONTENT-SPEC.md §2 decision 8 / §3): the
 * "this chart has a guide" pattern (GitLab Pajamas / Stripe-dashboard style). `GuideDrawer` is the
 * controlled right-side drawer rendering an article via `Markdown`/`Prose` at article density with
 * an "open full page" escape hatch; `GuideLink` is the uncontrolled quiet trigger + drawer pair —
 * mount it next to whatever it explains (a chart, a StatCard, a settings row).
 *
 * @example
 * import { GuideLink } from 'basalt-ui/content'
 *
 * <GuideLink
 *   title="How p95 latency is measured"
 *   markdown={p95GuideMarkdown}
 *   fullPageHref="/guides/p95-latency"
 * />
 */
import type { ReactNode } from 'react'
import { ActionIcon, Button, Drawer } from '@mantine/core'
import type { DrawerProps } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import classes from './guide.module.css'
import type { ArticleNavTarget } from './article-layout'
import { Markdown } from './markdown'
import { Prose } from './prose'

function defaultRenderLink(target: ArticleNavTarget, node: ReactNode): ReactNode {
  return <a href={target.href}>{node}</a>
}

/**
 * Small inline help glyph — the framework ships no icon dependency.
 *
 * A question mark, not an `i`: DESIGN-SPEC §5 already spends `i` on ChartCard's info tooltip, and
 * two different affordances behind one glyph teaches the reader nothing. Not the open book it
 * replaced either — at 14px that read as an anonymous panel rather than a book.
 */
function GuideGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 17l0 .01" />
      <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />
    </svg>
  )
}

export type GuideDrawerProps = {
  readonly opened: boolean
  readonly onClose: () => void
  readonly title: string
  /** React-children body — mutually exclusive with `markdown` (`markdown` wins if both given). */
  readonly children?: ReactNode
  /** Markdown-string body, rendered via `Markdown` at article density. */
  readonly markdown?: string
  /** When given, renders an "Open full page" footer link. */
  readonly fullPageHref?: string
  /** Router bridge for the "Open full page" link. Default renders a plain `<a href>`. */
  readonly renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  readonly size?: DrawerProps['size']
}

export function GuideDrawer({
  opened,
  onClose,
  title,
  children,
  markdown,
  fullPageHref,
  renderLink = defaultRenderLink,
  size = 440,
}: GuideDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={size}
      title={<span className={classes.drawerTitle}>{title}</span>}
    >
      <div className={classes.body}>
        {markdown !== undefined ? (
          <Markdown density="article" measure={false}>
            {markdown}
          </Markdown>
        ) : (
          <Prose density="article" measure={false}>
            {children}
          </Prose>
        )}
      </div>

      {fullPageHref !== undefined && (
        <div className={classes.footer}>
          {renderLink(
            { label: 'Open full page', href: fullPageHref },
            <span className={classes.footerLink}>Open full page →</span>,
          )}
        </div>
      )}
    </Drawer>
  )
}

export type GuideLinkProps = {
  /** Trigger label. Default `'Guide'`. */
  readonly label?: string
  readonly title: string
  readonly children?: ReactNode
  readonly markdown?: string
  readonly fullPageHref?: string
  readonly renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  /** Render the trigger as an icon-only `ActionIcon` instead of a labeled button. Default `false`. */
  readonly iconOnly?: boolean
}

export function GuideLink({
  label = 'Guide',
  title,
  children,
  markdown,
  fullPageHref,
  renderLink,
  iconOnly = false,
}: GuideLinkProps) {
  const [opened, { open, close }] = useDisclosure(false)

  return (
    <>
      {iconOnly ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          className={classes.trigger}
          onClick={open}
          aria-label={label}
        >
          <GuideGlyph />
        </ActionIcon>
      ) : (
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          className={classes.trigger}
          leftSection={<GuideGlyph />}
          onClick={open}
        >
          <span className={classes.triggerLabel}>{label}</span>
        </Button>
      )}

      <GuideDrawer
        opened={opened}
        onClose={close}
        title={title}
        {...(children !== undefined && { children })}
        {...(markdown !== undefined && { markdown })}
        {...(fullPageHref !== undefined && { fullPageHref })}
        {...(renderLink !== undefined && { renderLink })}
      />
    </>
  )
}
