import { Input as BaseInput } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import type { ComponentProps, CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Textarea` cva table. The box grows with its content (`field-sizing: content`) from a floor of
 * `rows` lines (`--textarea-rows`, set by the component) to a ceiling of 10 lines, then scrolls. An
 * engine without `field-sizing` keeps the fixed `rows` box. A coarse pointer gets the 44 px floor and
 * 16 px text (below that iOS Safari zooms the page on focus). No axes.
 *
 * @example
 * textareaVariants() // class string for a hand-built textarea
 */
export const textareaVariants = cva(
  'block field-sizing-content min-h-[calc(var(--textarea-rows,3)*1lh+1rem+2px)] max-h-[calc(10lh+1rem+2px)] w-full min-w-0 resize-y rounded-ctrl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint focus-ring transition-colors aria-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-[max(2.75rem,calc(var(--textarea-rows,3)*1lh+1rem+2px))] pointer-coarse:text-base',
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
  /** Layout only (`max-w-md`, `resize-none`, a taller ceiling `max-h-96`). The floor belongs to `rows`. */
  className?: string
}

/**
 * A multi-line text field on Base UI's `Input`, rendered as a `<textarea>`. It grows with its
 * content from `rows` lines (default 3) to 10, then scrolls; where `field-sizing` is unsupported it
 * stays the fixed `rows` box. Works with no provider and joins a Base UI `Field` when wrapped in one.
 *
 * @useWhen free text of several lines (a note, a message)
 * @neverWhen one line (use Input) or markdown the user reads back (use Markdown for the display)
 * @example
 * <Textarea value={note} onValueChange={setNote} rows={4} aria-label="Note" />
 */
export function Textarea({ className, rows = 3, style, ...props }: TextareaProps): ReactElement {
  return (
    <BaseInput
      // The textarea attributes are a superset of what Base UI's input props type; the runtime
      // control is the same Field.Control and the element is swapped by `render`.
      {...(props as BaseInput.Props)}
      render={<textarea rows={rows} />}
      style={{ ...style, '--textarea-rows': rows } as CSSProperties}
      data-slot="textarea"
      className={cn(textareaVariants(), className)}
    />
  )
}
