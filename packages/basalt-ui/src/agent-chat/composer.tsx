/**
 * Composer — a pure, prop-driven message input: autosize Textarea + send action.
 *
 * Enter submits (trims, ignores empty, then clears); Shift+Enter inserts a newline. No store or
 * fetching coupling — the caller owns wiring `onSubmit` to whatever sends the message.
 *
 * @example
 * import { Composer } from 'basalt-ui/agent-chat'
 *
 * <Composer onSubmit={(text) => send(text)} disabled={streaming} placeholder="Send a message…" />
 */
import { ActionIcon, Group, Textarea } from '@mantine/core'
import type { ComponentProps, JSX, KeyboardEvent } from 'react'
import { useState } from 'react'

/** A minimal, dependency-free send-arrow glyph (icons are passed in as ReactNode elsewhere; this
 * one is inline since Composer has no icon prop in its contract). */
function SendGlyph(): JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l16 -7l-7 16l-2 -7l-7 -2z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export type ComposerProps = {
  /** Called with the trimmed, non-empty text on submit. The input is cleared afterward. */
  readonly onSubmit: (text: string) => void
  /** Disables the textarea and the send action (e.g. while a run is streaming). */
  readonly disabled?: boolean
  readonly placeholder?: string
  /** Autofocuses the textarea on mount. */
  readonly autoFocus?: boolean
}

/**
 * An autosize Textarea + send ActionIcon. Enter submits, Shift+Enter inserts a newline.
 *
 * @example
 * <Composer onSubmit={onSend} disabled={streaming} />
 */
export function Composer({
  onSubmit,
  disabled = false,
  placeholder,
  autoFocus,
}: ComposerProps): JSX.Element {
  const [value, setValue] = useState('')

  const submit = (): void => {
    const trimmed = value.trim()
    if (trimmed.length === 0 || disabled) return
    onSubmit(trimmed)
    setValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    submit()
  }

  const textareaProps: ComponentProps<typeof Textarea> = {
    flex: 1,
    autosize: true,
    minRows: 1,
    maxRows: 6,
    radius: 'md',
    value,
    disabled,
    onChange: (event) => setValue(event.currentTarget.value),
    onKeyDown: handleKeyDown,
  }
  if (placeholder !== undefined) textareaProps.placeholder = placeholder
  if (autoFocus !== undefined) textareaProps.autoFocus = autoFocus

  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <Textarea {...textareaProps} />
      <ActionIcon
        size={42}
        radius="md"
        variant="filled"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label="Send message"
      >
        <SendGlyph />
      </ActionIcon>
    </Group>
  )
}
