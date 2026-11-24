/**
 * The one option row every list draws (`Select`, `Combobox`, the command palette): icon or avatar,
 * label over description, a trailing hint or shortcut, and the check of the selected value. The
 * group header and the state rows (loading, empty, error) sit beside it so they match it.
 */
import { cva } from 'class-variance-authority'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { cn } from '../cn'
import { select } from '../messages/select'
import { useMessages } from '../messages/use-messages'
import { Avatar } from '../../ui/avatar'
import type { ListOption } from './options'

/** How tall a row is: `sm` and `md` follow the control sizes, `lg` is the palette's row. */
export type RowSize = 'sm' | 'md' | 'lg'

/**
 * The row box. It is the Base UI item itself, so the highlight and the disabled state are its data
 * attributes. A coarse pointer lifts it to the 44 px floor.
 */
export const optionRowVariants = cva(
  'relative flex w-full cursor-default items-center rounded-chip text-left outline-none select-none data-highlighted:bg-accent active:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
  {
    variants: {
      size: {
        sm: 'min-h-6 gap-1.5 px-1.5 py-0.5 text-xs',
        md: 'min-h-ctl gap-2 px-2 py-1 text-sm',
        lg: 'min-h-row gap-3 px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** The group header: a quiet label over its run of rows, aligned with the row text. */
export const groupLabelVariants = cva('block truncate font-medium text-muted-foreground', {
  variants: {
    size: {
      sm: 'px-1.5 pt-1.5 pb-0.5 text-micro',
      md: 'px-2 pt-2 pb-1 text-xs',
      lg: 'px-3 pt-2.5 pb-1 text-xs',
    },
  },
  defaultVariants: { size: 'md' },
})

/** A state row (loading, empty, error): the row's inset, in the muted ink. */
export const statusRowVariants = cva('text-muted-foreground', {
  variants: {
    size: {
      sm: 'px-1.5 py-1 text-xs',
      md: 'px-2 py-1.5 text-sm',
      lg: 'px-3 py-2.5 text-sm',
    },
  },
  defaultVariants: { size: 'md' },
})

/** The check of the selected row. */
export function CheckMark(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon shrink-0" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export type OptionRowBodyProps<Value> = {
  option: Pick<ListOption<Value>, 'label' | 'description' | 'icon' | 'avatar' | 'hint'>
  size: RowSize
  /** Wraps the label: `Select` passes its item text so typeahead and the trigger read it. */
  Text?:
    | ComponentType<{ className?: string; children?: ReactNode; 'data-slot'?: string }>
    | undefined
  /** After the hint: a shortcut's keys. */
  trailing?: ReactNode
  /**
   * Last: the selected check, inside the shell's own indicator. Its slot keeps its width on every
   * row, so a hint ends on one column whether or not the row is selected.
   */
  check?: ReactNode
}

/**
 * The inside of a row; the shell's Base UI item is the box (`optionRowVariants`).
 *
 * @example
 * <BaseCombobox.Item className={optionRowVariants({ size })}><OptionRowBody option={o} size={size} /></BaseCombobox.Item>
 */
export function OptionRowBody<Value>({
  option,
  size,
  Text,
  trailing,
  check,
}: OptionRowBodyProps<Value>): ReactElement {
  const { icon: Icon, avatar, label, description, hint } = option
  const LabelText = Text ?? 'span'
  return (
    <>
      {avatar !== undefined ? (
        <Avatar
          name={avatar.name}
          {...(avatar.src !== undefined && { src: avatar.src })}
          {...(avatar.icon !== undefined && { icon: avatar.icon })}
          size={size === 'lg' ? 'md' : size === 'md' ? 'sm' : 'xs'}
          aria-hidden="true"
        />
      ) : (
        Icon !== undefined && (
          <Icon className="size-icon shrink-0 text-muted-foreground" aria-hidden="true" />
        )
      )}
      <span data-slot="option-text" className="flex min-w-0 flex-1 flex-col">
        <LabelText data-slot="option-label" className="truncate">
          {label}
        </LabelText>
        {description !== undefined && (
          <span
            data-slot="option-description"
            className={cn(
              'truncate text-muted-foreground',
              size === 'sm' ? 'text-micro' : 'text-xs',
            )}
          >
            {description}
          </span>
        )}
      </span>
      {hint !== undefined && (
        <span
          data-slot="option-hint"
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
        >
          {hint}
        </span>
      )}
      {trailing}
      {check !== undefined && (
        <span data-slot="option-check" className="flex size-icon shrink-0 items-center">
          {check}
        </span>
      )}
    </>
  )
}

/** The create row's text: `Create "<text>"` from the message key `combobox.create`. */
export function CreateRowText({ text }: { text: string }): ReactElement {
  const t = useMessages(select)
  return <span className="min-w-0 flex-1 truncate">{t('combobox.create', text)}</span>
}

export type ListStatus = 'ready' | 'loading' | 'error'

/** The words of an error, for the error row: its message, or nothing. */
function causeOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}

/**
 * The state row above the options: loading while a loader runs, the error when it failed, or the
 * empty text when nothing matched. Nothing when the list is ready and has rows.
 */
export function ListStatusRow({
  status,
  error,
  empty,
  hasRows,
  size,
}: {
  status: ListStatus
  error: unknown
  /** Replaces the default empty text (`select.empty`). */
  empty?: ReactNode
  hasRows: boolean
  size: RowSize
}): ReactElement | null {
  const t = useMessages(select)
  if (status === 'ready' && hasRows) return null
  const text =
    status === 'loading'
      ? t('select.loading')
      : status === 'error'
        ? t('select.error', causeOf(error))
        : (empty ?? t('select.empty'))
  return (
    <output
      data-slot="option-status"
      data-status={status === 'ready' ? 'empty' : status}
      className={statusRowVariants({ size })}
    >
      {text}
    </output>
  )
}
