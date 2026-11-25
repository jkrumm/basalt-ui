import { Input as BaseInput } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider, scopeClass, useControlScope } from '../core/control-scope'
import type { IconComponent } from '../core/ports'

/**
 * The `Input` cva table. A coarse pointer keeps the density's height and text size; the iOS focus
 * zoom is stopped in the head (`themeScript()`), never by a larger field. A read-only field keeps its value readable: the inset surface, no border,
 * no editable affordance; it never takes the disabled opacity.
 *
 * @example
 * inputVariants({ size: 'sm' })
 */
export const inputVariants = cva(
  'w-full min-w-0 rounded-ctrl border border-input bg-background text-foreground placeholder:text-faint focus-ring transition-colors [&[readonly]]:cursor-default [&[readonly]]:border-transparent [&[readonly]]:bg-inset aria-invalid:border-bad data-disabled:opacity-50',
  {
    variants: {
      size: {
        md: 'h-ctl px-3 text-sm',
        sm: 'h-6 px-2 text-xs',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const inputParts = ['input'] as const

export type InputProps = Omit<BaseInput.Props, 'className' | 'size'> &
  VariantProps<typeof inputVariants> & {
    /** Layout only (`w-full`, `max-w-xs`, `flex-1`). Height belongs to `size`. With `start` or `end` it sits on the wrapper. */
    className?: string
    /** A non-interactive leading icon, drawn inside the field. */
    start?: IconComponent
    /**
     * A trailing unit (`ms`) or one small button, drawn inside the field. A button here acts on this
     * field only (reveal, clear, copy); one that reaches further sits beside it in a `ControlGroup`.
     */
    end?: ReactNode
  }

/**
 * A text input on Base UI. Works with no provider and joins a Base UI `Field` when wrapped in one.
 * `start` and `end` put an icon or a unit inside the field; without them the DOM is the bare input.
 *
 * @useWhen one line of free text, a number as text, a search or an email
 * @neverWhen several lines (use Textarea), a number with steppers (use NumberField), or a choice from known values (use Select or Combobox)
 * @example
 * <Input value={q} onValueChange={setQ} placeholder="Search" start={SearchIcon} />
 * <Input size="sm" aria-label="Quantity" inputMode="numeric" end="pcs" />
 */
export function Input({ size, className, start: Start, end, ...props }: InputProps): ReactElement {
  const scope = useControlScope()
  const table = inputVariants({ size: size ?? scope?.size })
  if (Start === undefined && end === undefined) {
    return (
      <BaseInput {...props} data-slot="input" className={cn(table, scopeClass(scope), className)} />
    )
  }
  return (
    <div
      data-input-group=""
      className={cn('relative w-full min-w-0', scopeClass(scope), className)}
    >
      <BaseInput
        {...props}
        data-slot="input"
        className={cn(table, Start !== undefined && 'ps-8', end !== undefined && 'pe-8')}
      />
      {Start !== undefined && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-2.5 text-muted-foreground">
          <Start className="size-icon" aria-hidden="true" />
        </span>
      )}
      {end !== undefined && (
        <span className="absolute inset-y-0 end-0 flex items-center gap-1 pe-2.5 text-muted-foreground">
          {/* A button in the field belongs to the field, never to a group around it. */}
          <ControlScopeProvider value={null}>{end}</ControlScopeProvider>
        </span>
      )}
    </div>
  )
}
