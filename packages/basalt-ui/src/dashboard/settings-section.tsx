/**
 * SettingsSection / SettingsRow / DangerZone — the settings-page building blocks
 * (docs/DESIGN-SPEC.md §5). A `SettingsSection` is a titled card grouping a stack of
 * `SettingsRow`s, each separated by a 1px `--vx-divider` rule (no border on the last row —
 * handled by the shared `.rows` container in `settings-section.module.css`). `DangerZone` is a
 * `SettingsSection` variant for irreversible actions: a mono "DANGER ZONE" eyebrow in
 * status-danger, and a danger-tinted ring layered atop the card's shadow-card depth.
 *
 * @example
 * import { SettingsSection, SettingsRow, DangerZone } from 'basalt-ui'
 *
 * <SettingsSection title="Profile" description="Your public identity.">
 *   <SettingsRow label="Display name" control={<TextInput value={name} onChange={...} />} />
 *   <SettingsRow
 *     label="Email"
 *     description="Used for sign-in and receipts."
 *     control={<TextInput value={email} onChange={...} />}
 *   />
 * </SettingsSection>
 *
 * <DangerZone title="Delete workspace" description="This action cannot be undone.">
 *   <SettingsRow
 *     label="Delete this workspace"
 *     control={<Button color="red" variant="outline">Delete</Button>}
 *   />
 * </DangerZone>
 */
import { Card, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { alpha, VX } from '../tokens'
import classes from './settings-section.module.css'

const titleStyle = {
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%' as const,
  fontSize: VX.text.xl,
  fontWeight: 550,
  color: VX.ink,
}

const eyebrowStyle = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: VX.status.bad,
}

export type SettingsSectionProps = {
  /** Head-font section title (15px, weight 550, ink). */
  title: string
  /** Optional 13px muted description below the title. */
  description?: string
  /** Section body — typically a stack of `SettingsRow`s. */
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Card style={{ padding: '17px 19px' }}>
      <Stack gap={2} mb={12}>
        <span style={titleStyle}>{title}</span>
        {description && (
          <span style={{ fontSize: VX.text.md, color: VX.muted }}>{description}</span>
        )}
      </Stack>
      <div className={classes.rows}>{children}</div>
    </Card>
  )
}

export type SettingsRowProps = {
  /** 13px ink label on the left. */
  label: string
  /** Optional 12.5px muted description under the label. */
  description?: string
  /** Right-aligned control (input/switch/button). */
  control?: ReactNode
  /** Alternative to `control` for a fully custom right-hand region. */
  children?: ReactNode
}

export function SettingsRow({ label, description, control, children }: SettingsRowProps) {
  return (
    <div className={classes.row}>
      <Stack gap={2}>
        <span style={{ fontSize: VX.text.md, color: VX.ink }}>{label}</span>
        {description && (
          <span style={{ fontSize: VX.text.sm, color: VX.muted }}>{description}</span>
        )}
      </Stack>
      <div className={classes.control}>{control ?? children}</div>
    </div>
  )
}

export type DangerZoneProps = SettingsSectionProps

export function DangerZone({ title, description, children }: DangerZoneProps) {
  return (
    <Card
      style={{
        padding: '17px 19px',
        boxShadow: `${VX.shadowCard}, 0 0 0 1px ${alpha(VX.status.bad, 0.25)}`,
      }}
    >
      <Stack gap={2} mb={12}>
        <span style={eyebrowStyle}>Danger Zone</span>
        <span style={titleStyle}>{title}</span>
        {description && (
          <span style={{ fontSize: VX.text.md, color: VX.muted }}>{description}</span>
        )}
      </Stack>
      <div className={classes.rows}>{children}</div>
    </Card>
  )
}
