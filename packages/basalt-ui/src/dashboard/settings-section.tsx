/**
 * SettingsSection / SettingsRow / DangerZone — the settings-page building blocks
 * (docs/DESIGN-SPEC.md §5, docs/CONTROLS-SPEC.md §2.2). A `SettingsSection` is a titled card
 * grouping a stack of `SettingsRow`s, each separated by a 1px `--vx-divider` rule (no border on the
 * last row — handled by the shared `.rows` container in `settings-section.module.css`). `DangerZone`
 * is a `SettingsSection` variant for irreversible actions: a mono "DANGER ZONE" eyebrow in
 * status-danger, and a danger-tinted ring layered atop the card's shadow-card depth.
 *
 * Both compose `WidgetHeader tier="section"` for the title/subtitle/actions row — `actions` is
 * wrapped in `CtlSlot` (C1/C5).
 *
 * @example
 * import { SettingsSection, SettingsRow, DangerZone } from 'basalt-ui'
 *
 * <SettingsSection title="Profile" subtitle="Your public identity.">
 *   <SettingsRow label="Display name" control={<TextInput value={name} onChange={...} />} />
 *   <SettingsRow
 *     label="Email"
 *     description="Used for sign-in and receipts."
 *     control={<TextInput value={email} onChange={...} />}
 *   />
 * </SettingsSection>
 *
 * <DangerZone title="Delete workspace" subtitle="This action cannot be undone.">
 *   <SettingsRow
 *     label="Delete this workspace"
 *     control={<Button color="red" variant="outline">Delete</Button>}
 *   />
 * </DangerZone>
 */
import { Card, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { WidgetHeader } from './widget-header'
import type { WidgetHeaderTitleProps } from './widget-header'
import { CtlSlot } from '../theme'
import { VX } from '../tokens'
import { cx, pickDataAttributes } from '../common/props'
import type { BasaltProps, DataAttributes, SlotStylesProps } from '../common/props'
import classes from './settings-section.module.css'

const eyebrowStyle = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.xs,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: VX.status.bad,
}

/** The three boxes `SettingsSection`/`DangerZone` paint (`common/props.ts`). */
export type SettingsSectionSlot = 'root' | 'header' | 'body'

/**
 * Composed from the named `WidgetHeaderTitleProps` slice (audit B #2) rather than a hand-picked
 * `title`/`subtitle` pair — which is why `icon` and `info` now reach the header too. `value`/`delta`
 * are deliberately NOT taken: a settings section groups controls, it states no metric.
 *
 * `Section` and `ChartCard` still cut their own ad-hoc subsets; both should move onto the same
 * slices.
 */
export type SettingsSectionProps = BasaltProps &
  DataAttributes &
  SlotStylesProps<SettingsSectionSlot> &
  WidgetHeaderTitleProps & {
    /** Header-right slot — wrapped in `CtlSlot` (C1/C5). */
    actions?: ReactNode
    /** Section body — typically a stack of `SettingsRow`s. */
    children: ReactNode
  }

export function SettingsSection({
  title,
  icon,
  subtitle,
  info,
  actions,
  children,
  className,
  style,
  classNames,
  ...rest
}: SettingsSectionProps) {
  return (
    <Card {...pickDataAttributes(rest)} className={cx(classNames?.root, className)} style={style}>
      <div className={cx(classes.header, classNames?.header)}>
        <WidgetHeader
          tier="section"
          title={title}
          {...(icon !== undefined && { icon })}
          {...(subtitle !== undefined && { subtitle })}
          {...(info !== undefined && { info })}
          {...(actions !== undefined && { actions: <CtlSlot>{actions}</CtlSlot> })}
        />
      </div>
      <div className={cx(classes.rows, classNames?.body)}>{children}</div>
    </Card>
  )
}

/** The three boxes `SettingsRow` paints (`common/props.ts`). */
export type SettingsRowSlot = 'root' | 'label' | 'control'

export type SettingsRowProps = BasaltProps &
  SlotStylesProps<SettingsRowSlot> & {
    /** 13px ink label on the left. */
    label: string
    /** Optional 12px muted description under the label. */
    description?: string
    /**
     * Right-aligned control (input/switch/button). Mounted in a `CtlSlot`: a bound input is the 32 px
     * field (44 under a coarse pointer), not Mantine's 42 px `md`; a control's own `size` still wins.
     */
    control?: ReactNode
    /** Alternative to `control` for a fully custom right-hand region. */
    children?: ReactNode
  }

export function SettingsRow({
  label,
  description,
  control,
  children,
  className,
  style,
  classNames,
}: SettingsRowProps) {
  return (
    <div
      className={cx(classes.row, classNames?.root, className)}
      {...(style !== undefined && { style })}
    >
      <Stack gap={2} {...(classNames?.label !== undefined && { className: classNames.label })}>
        <span style={{ fontSize: VX.text.sm, color: VX.ink }}>{label}</span>
        {description && (
          <span style={{ fontSize: VX.text.xs, color: VX.muted }}>{description}</span>
        )}
      </Stack>
      <div className={cx(classes.control, classNames?.control)}>
        <CtlSlot>{control ?? children}</CtlSlot>
      </div>
    </div>
  )
}

export type DangerZoneProps = SettingsSectionProps

export function DangerZone({
  title,
  icon,
  subtitle,
  info,
  actions,
  children,
  className,
  style,
  classNames,
  ...rest
}: DangerZoneProps) {
  return (
    <Card
      {...pickDataAttributes(rest)}
      className={cx(classes.danger, classNames?.root, className)}
      style={{
        // ONE edge in the class's ring colour, then the card's depth. The ring leads: the first shadow paints on
        // top, and shadow-card carries its own 1px ring in light that would cover a ring layered after it.
        boxShadow: `0 0 0 1px var(--danger-ring), ${VX.shadowCard}`,
        ...style,
      }}
    >
      <div className={cx(classes.header, classNames?.header)}>
        <span style={eyebrowStyle}>Danger Zone</span>
        <WidgetHeader
          tier="section"
          title={title}
          {...(icon !== undefined && { icon })}
          {...(subtitle !== undefined && { subtitle })}
          {...(info !== undefined && { info })}
          {...(actions !== undefined && { actions: <CtlSlot>{actions}</CtlSlot> })}
        />
      </div>
      <div className={cx(classes.rows, classNames?.body)}>{children}</div>
    </Card>
  )
}
