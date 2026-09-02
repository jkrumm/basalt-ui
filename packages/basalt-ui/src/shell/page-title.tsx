/**
 * `PageTitle` — the shell-less page-title primitive (C5 consolidation). Law C8
 * (`docs/CONTROLS-SPEC.md` §2.2) names two sanctioned spots for a page's ONE name: the breadcrumb
 * inside `BasaltShell`, or `PageBar.title` in a shell-less app — but neither fits a surface that
 * has no `PageBar` at all, which is exactly what `BasaltErrorBoundary`'s default fallback and an
 * auth gate ARE. Both were the two named `in-body-page-title` waivers this primitive closes
 * (argo's `lib/error-boundary.tsx:36`, `lib/auth-gate.tsx:30` — each a bare `<Title order={2}>` +
 * a muted subtitle line, hand-copied).
 *
 * A plain `<h1>` + CSS module, NOT Mantine's `<Title>` component — same reason `page-bar.tsx`'s
 * own `title` row does (`page-bar.module.css`'s `.title`): `basalt/in-body-page-title` and its
 * text-lane twin both match the JSX tag `<Title`, so a THIRD sanctioned spot built out of that
 * same tag would need a waiver on itself. A raw, styled `<h1>` needs none — it IS the remedy, not
 * a case of it.
 *
 * @example
 * import { PageTitle } from 'basalt-ui'
 *
 * <PageTitle title="Something went wrong" subtitle="The page hit an unexpected error." />
 */
import { cx } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import type { ReactNode } from 'react'
import classes from './page-title.module.css'

export type PageTitleSlot = 'root' | 'title' | 'subtitle'

export type PageTitleProps = BasaltProps &
  SlotStylesProps<PageTitleSlot> & {
    /** The page's one name. */
    title: ReactNode
    /** Optional muted line below the title. */
    subtitle?: ReactNode
    /** Optional leading icon, rendered before the title. Decorative — hidden from assistive tech,
     * same convention as `WidgetHeader.icon`. */
    icon?: ReactNode
  }

export function PageTitle(props: PageTitleProps): ReactNode {
  assertRequiredProps('PageTitle', props, ['title'])
  const { title, subtitle, icon, className, classNames, style } = props
  return (
    <div
      className={cx(classes.root, classNames?.root, className)}
      {...(style !== undefined && { style })}
    >
      <div className={cx(classes.titleRow, classNames?.title)}>
        {icon !== undefined && <span aria-hidden="true">{icon}</span>}
        <h1 className={classes.title}>{title}</h1>
      </div>
      {subtitle !== undefined && (
        <p className={cx(classes.subtitle, classNames?.subtitle)}>{subtitle}</p>
      )}
    </div>
  )
}
