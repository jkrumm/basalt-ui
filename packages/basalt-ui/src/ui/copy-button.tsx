import { Button as BaseButton } from '@base-ui/react/button'
import type { VariantProps } from 'class-variance-authority'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { GROUPED_SMALL_BUTTON, buttonScopeClass, useControlScope } from '../core/control-scope'
import { base as baseMessages } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'
import { buttonVariants } from './button'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const copyButtonParts = ['copy-button'] as const

type ButtonAxes = VariantProps<typeof buttonVariants>

export type CopyButtonProps = Omit<
  BaseButton.Props,
  'className' | 'children' | 'onClick' | 'aria-label' | 'value'
> &
  Omit<ButtonAxes, 'shape'> & {
    /** The text written to the clipboard. */
    value: string
    /** What is copied, for the accessible name: "Copy API key". Without it the name is "Copy". */
    label?: string
    /** Draws the word beside the glyph; without it the button is icon-only. */
    showLabel?: boolean
    /** Fires after the clipboard took the value. */
    onCopied?: (value: string) => void
    /** Layout only (`ml-auto`). Height and display belong to `size`. */
    className?: string
  }

/** Writes `text` to the clipboard; outside a secure context (plain http) through a hidden textarea. */
async function writeClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard !== undefined) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  // execCommand is deprecated but is the one clipboard write an insecure context still has.
  const ok = document.execCommand('copy')
  area.remove()
  return ok
}

function CopyGlyph({ done }: { done: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      {done ? (
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" />
          <path
            d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5"
            stroke="currentColor"
          />
        </>
      )}
    </svg>
  )
}

/**
 * A button that copies `value` to the clipboard and says so: the glyph turns to a check and the
 * name (the word too, with `showLabel`) to "Copied" until the pointer or focus leaves. Ghost and
 * icon-only by default, so it fits an `Input` `end` slot or a code line; `showLabel` adds the
 * word. Works on plain http too.
 *
 * @useWhen a value the user copies elsewhere: an API key, an id, a URL, a command
 * @neverWhen the action does more than copy (use Button), or the text is long prose (let the user select it)
 * @example
 * <Input readOnly value={key} end={<CopyButton value={key} label="API key" size="sm" />} />
 * <CopyButton value={url} showLabel variant="secondary" />
 */
export function CopyButton({
  value,
  label,
  showLabel = false,
  onCopied,
  variant,
  size,
  className,
  onPointerLeave,
  onBlur,
  ...props
}: CopyButtonProps): ReactElement {
  const t = useMessages(baseMessages)
  const [done, setDone] = useState(false)
  const word = done ? t('base.copy.done') : t('base.copy.action')
  const name = label === undefined || done ? word : `${word} ${label}`
  const copy = async (): Promise<void> => {
    if (!(await writeClipboard(value))) return
    setDone(true)
    onCopied?.(value)
  }
  const scope = useControlScope()
  const resolved = size ?? scope?.size
  const shape = showLabel ? 'default' : 'icon'
  return (
    <BaseButton
      {...props}
      // The name leads with the visible word, so a label beside it still meets label-in-name.
      aria-label={name}
      data-slot="copy-button"
      data-copied={done ? '' : undefined}
      className={cn(
        buttonVariants({ variant: variant ?? scope?.variant ?? 'ghost', size: resolved, shape }),
        buttonScopeClass(scope),
        scope !== null && resolved === 'sm' && GROUPED_SMALL_BUTTON,
        className,
      )}
      onClick={() => void copy()}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        setDone(false)
      }}
      onBlur={(event) => {
        onBlur?.(event)
        setDone(false)
      }}
    >
      <CopyGlyph done={done} />
      {showLabel && <span>{word}</span>}
    </BaseButton>
  )
}
