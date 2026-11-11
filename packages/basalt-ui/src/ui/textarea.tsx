import { Input as BaseInput } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Textarea` cva table. Height comes from `rows` (fixed, autosize is not offered), a coarse
 * pointer gets the 44 px floor and 16 px text (below that iOS Safari zooms the page on focus). No
 * axes.
 *
 * @example
 * textareaVariants() // class string for a hand-built textarea
 */
export const textareaVariants = cva(
  'block w-full min-w-0 resize-y rounded-ctrl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint focus-ring transition-colors aria-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const textareaParts = ['textarea'] as const

export type TextareaProps = Omit<
  ComponentProps<'textarea'>,
  'className' | 'value' | 'defaultValue' | 'children'
> & {
  value?: string
  defaultValue?: string
  /** Fires with the next text; use it to control the field. */
  onValueChange?: BaseInput.Props['onValueChange']
  /** Layout only (`max-w-md`, `resize-none`). Height belongs to `rows`. */
  className?: string
}

/**
 * A multi-line text field on Base UI's `Input`, rendered as a `<textarea>`. Height is the fixed
 * `rows` (default 3). Works with no provider and joins a Base UI `Field` when wrapped in one.
 *
 * @example
 * <Textarea value={note} onValueChange={setNote} rows={4} aria-label="Note" />
 */
export function Textarea({ className, rows = 3, ...props }: TextareaProps): ReactElement {
  return (
    <BaseInput
      // The textarea attributes are a superset of what Base UI's input props type; the runtime
      // control is the same Field.Control and the element is swapped by `render`.
      {...(props as BaseInput.Props)}
      // theme-allow raw-form-control — this primitive is the themed textarea: Base UI's Input renders it
      render={<textarea rows={rows} />}
      data-slot="textarea"
      className={cn(textareaVariants(), className)}
    />
  )
}
