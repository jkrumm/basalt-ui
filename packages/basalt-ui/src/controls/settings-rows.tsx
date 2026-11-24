/**
 * The settings rows that hold no stored value: an action (`FormActionRow`), a destructive action
 * that asks for its name first (`FormConfirmRow`), and a row that opens to a list of rows
 * (`FormGroupRow`). Each is one row of a `FormSection`'s box, carries an `id` a link can target
 * and keeps the one label, one control height and one focus ring of the rows around it.
 */
import { useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { IconComponent } from '../core/ports'
import { Button } from '../ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { FormFieldLayoutContext } from './form-field'
import { RowIcon } from './row-icon'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const settingsRowParts = [
  'form-action-row',
  'form-confirm-row',
  'form-group-row',
  'form-group-row-trigger',
  'form-group-row-panel',
] as const

/** `danger` is a destructive row: its name reads in the verdict color and its button is `danger`. */
export type SettingsRowTone = 'default' | 'danger'

/** A row's own target: the flash `SettingsLayout` sets when a link points at it. */
const ROW_FLASH = 'transition-colors duration-slow data-flash:bg-selected'

const hasDescription = (description: ReactNode): boolean =>
  description !== undefined && description !== null && description !== ''

type RowTextProps = {
  labelId: string
  descriptionId: string
  label: ReactNode
  description: ReactNode
  tone: SettingsRowTone
}

/** The label and the description of a row that has no field to name them. */
function RowText({ labelId, descriptionId, label, description, tone }: RowTextProps): ReactElement {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span
        id={labelId}
        className={cn('text-sm font-medium', tone === 'danger' ? 'text-bad' : 'text-foreground')}
      >
        {label}
      </span>
      {hasDescription(description) && (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  )
}

function Tile({ icon }: { icon: IconComponent | undefined }): ReactElement | null {
  return icon === undefined ? null : <RowIcon icon={icon} />
}

type CommonRowProps = {
  /** The row's name. Required: the row's group takes its accessible name from it. */
  label: NonNullable<ReactNode>
  /** Help text under the label. */
  description?: ReactNode
  /** An icon tile at the start of the row. */
  icon?: IconComponent
  /** A stable id for the row, a target for a link (`#row-delete`): `SettingsLayout` scrolls to it and marks it once. */
  id?: string
  /** `danger` reads in the verdict color. Default `default`. */
  tone?: SettingsRowTone
  /** Layout only (`w-full`). */
  className?: string
}

export type FormActionRowProps = CommonRowProps & {
  /** The control at the end of the row: a `Button` (`variant="danger"` for a destructive one). */
  action: ReactNode
}

/**
 * A row whose control is an action, not a value: `Export data`, `Revoke key`, `Delete workspace`.
 * The label and description sit at the start, the button at the end, stacked below the regular tier.
 * A destructive action that cannot be undone asks for the name first: `FormConfirmRow`.
 *
 * @useWhen a settings row runs a command (export, revoke, reset) and holds no value
 * @neverWhen the row stores a value (FormField), or the action destroys data (FormConfirmRow)
 *
 * @example
 * <FormActionRow label="Export data" description="A CSV of every record." action={<Button onClick={run}>Export</Button>} />
 */
export function FormActionRow({
  label,
  description,
  icon,
  id,
  tone = 'default',
  action,
  className,
}: FormActionRowProps): ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <fieldset
      data-slot="form-action-row"
      aria-labelledby={labelId}
      {...(hasDescription(description) && { 'aria-describedby': descriptionId })}
      {...(id !== undefined && { id })}
      className={cn('m-0 min-w-0 border-0 p-0', ROW_FLASH, className)}
    >
      <div className="@container min-w-0">
        <div className="flex min-w-0 flex-col gap-3 @regular:flex-row @regular:items-center @regular:gap-4">
          <Tile icon={icon} />
          <RowText
            labelId={labelId}
            descriptionId={descriptionId}
            label={label}
            description={description}
            tone={tone}
          />
          <div className="shrink-0">{action}</div>
        </div>
      </div>
    </fieldset>
  )
}

export type FormConfirmRowProps = CommonRowProps & {
  /** The text the person types to arm the button: the workspace's name, `delete`. Matched exactly. */
  confirmText: string
  /** The button's text, naming the act: `Delete workspace`. */
  actionLabel: string
  /** Runs once the typed text matches and the button is pressed; the field clears when it resolves. It owns its errors: a rejection keeps the text. */
  onConfirm: () => void | Promise<void>
}

/**
 * A destructive row that asks for its name: an input labelled with the text to type, and a button
 * that stays disabled until the typed text matches `confirmText`. Danger tone by default. The input
 * is a plain field, so it has the label, the control height and the one focus ring of every row.
 *
 * @useWhen an action deletes or transfers something that cannot be restored (a workspace, an account)
 * @neverWhen the action can be undone, or an AlertDialog already confirms it
 *
 * @example
 * <FormConfirmRow label="Delete workspace" description="Removes every project." confirmText="acme" actionLabel="Delete workspace" onConfirm={remove} />
 */
export function FormConfirmRow({
  label,
  description,
  icon,
  id,
  tone = 'danger',
  confirmText,
  actionLabel,
  onConfirm,
  className,
}: FormConfirmRowProps): ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const armed = typed === confirmText && confirmText !== ''
  // The caller owns its errors: a rejection keeps the typed text so the person can try again.
  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      await onConfirm()
      setTyped('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset
      data-slot="form-confirm-row"
      aria-labelledby={labelId}
      {...(hasDescription(description) && { 'aria-describedby': descriptionId })}
      {...(id !== undefined && { id })}
      className={cn('m-0 min-w-0 border-0 p-0', ROW_FLASH, className)}
    >
      <div className="@container min-w-0">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Tile icon={icon} />
            <RowText
              labelId={labelId}
              descriptionId={descriptionId}
              label={label}
              description={description}
              tone={tone}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 @regular:flex-row @regular:items-end">
            <Field
              label={`Type ${confirmText} to confirm`}
              className="min-w-0 flex-1 @regular:max-w-72"
            >
              <Input
                value={typed}
                onValueChange={setTyped}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
              />
            </Field>
            <Button
              variant={tone === 'danger' ? 'danger' : 'secondary'}
              disabled={!armed}
              loading={busy}
              onClick={() => void run().catch(() => {})}
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

export type FormGroupRowProps = Omit<CommonRowProps, 'tone'> & {
  /** A muted word or two at the end of the closed row (`3 of 5 on`). */
  summary?: ReactNode
  /** Opens the row at first. Default closed. */
  defaultOpen?: boolean
  /** The rows revealed: `FormField`s (switches), one per line, divided by hairlines. */
  children: ReactNode
}

function Chevron(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-icon shrink-0 text-muted-foreground transition-transform duration-fast motion-reduce:transition-none group-data-panel-open:rotate-180"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * An expandable row: the closed row is a label, a description and a summary at the start and a
 * chevron at the end; opened, it reveals a list of rows (usually switches) under a hairline. The
 * revealed rows stay mounted while closed, so a bound value and the browser's find keep working.
 * This is a row, not a section: a page of many groups splits with `InnerNav`, never collapsible
 * sections.
 *
 * @useWhen one setting fans out into several switches or fields (a notification category and its channels)
 * @neverWhen the revealed content is a page of its own (InnerNav), or the group is always visible (FormSection)
 *
 * @example
 * <FormGroupRow label="Deploys" description="Pipeline results." summary="2 of 3 on">
 *   <FormField label="Succeeded" control={a}><Switch /></FormField>
 *   <FormField label="Failed" control={b}><Switch /></FormField>
 * </FormGroupRow>
 */
export function FormGroupRow({
  label,
  description,
  icon,
  id,
  summary,
  defaultOpen = false,
  className,
  children,
}: FormGroupRowProps): ReactElement {
  return (
    <div
      data-slot="form-group-row"
      {...(id !== undefined && { id })}
      className={cn('min-w-0', ROW_FLASH, className)}
    >
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger
          data-slot="form-group-row-trigger"
          className="group flex w-full min-w-0 items-center gap-4 text-left"
        >
          <Tile icon={icon} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {hasDescription(description) && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </span>
          {summary !== undefined && summary !== null && (
            <span className="shrink-0 text-sm text-muted-foreground">{summary}</span>
          )}
          <Chevron />
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted hiddenUntilFound>
          <div
            data-slot="form-group-row-panel"
            className="mt-3.5 flex min-w-0 flex-col border-t border-border *:min-w-0 *:border-b *:border-border *:py-3 *:last:border-b-0 *:last:pb-0"
          >
            <FormFieldLayoutContext value="row">{children}</FormFieldLayoutContext>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
