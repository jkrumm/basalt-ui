/**
 * `ControlView`: the one place a bound control is drawn. It owns the label, the renderer of the
 * handle's kind and the override cue, so a page author who writes `spec(...)` cannot leave the cue
 * out. A control that overrides its global shows a neutral `Local` chip (text, never colour alone)
 * titled `Overrides global: <value>`, and a reset that unsets the override.
 *
 * The presentation (`pill`, `row`, `inline`) comes from the home through context; with no home it is
 * `pill`, the presentation of a `FilterSet` outside any `ControlHome`. There is no `variant` prop.
 */
import { createContext, use } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { controls } from '../core/messages/controls'
import { Lozenge } from '../ui/badge'
import { buttonVariants } from '../ui/button'
import type { ControlPresentation, FilterSpec } from './contract'
import { KindRenderer, describeValue } from './renderers'
import type { ControlSize } from './renderers'

/** Supplied by `ControlHome`; read by `ControlView`. */
export const ControlPresentationContext = createContext<ControlPresentation>('pill')

export type ControlViewProps = {
  // oxlint-disable-next-line typescript/no-explicit-any -- the concept's `FilterSpec<any>`: a list of specs of different `T` is mapped to views
  spec: FilterSpec<any>
  /** Layout only (`w-full`, `ml-auto`). */
  className?: string
}

const SIZE: Record<ControlPresentation, ControlSize> = { pill: 'md', row: 'md', inline: 'sm' }
const WIDTH: Record<ControlPresentation, string> = {
  pill: 'w-44 max-w-full',
  row: 'w-full',
  inline: 'w-32 max-w-full',
}

function ResetIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
      <path
        d="M3 8a5 5 0 1 0 1.6-3.7M3 3v3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * One bound control, drawn from its `spec`: the label, the input of the handle's kind and, when a
 * widget overrides its global, the cue and the reset. The cue is a neutral `Local` chip (text, never
 * colour alone) titled `Overrides global: <value>`, with `Use global` on a row and `Reset <label> to
 * global` elsewhere. The presentation comes from the home; there is no `variant` prop.
 *
 * @useWhen a home draws one `FilterSpec` and must show when a card overrides its global
 * @neverWhen you are laying out a page: put a `spec` in a `filterSlot` and let the home render it
 *
 * @example
 * <ControlView spec={spec(overview.widget.latency.range, 'Range')} />
 */
export function ControlView({ spec, className }: ControlViewProps): ReactElement {
  const presentation = use(ControlPresentationContext)
  const t = useMessages(controls)
  const [value, set] = spec.handle.use()
  // oxlint-disable-next-line react/rules-of-hooks -- a handle's hooks are fixed for its lifetime; one spec per mount
  const { source, inherited } = spec.handle.useSource()
  const overrides = source === 'override'
  const title = t('controls.overridesGlobal', describeValue(spec, inherited))
  const row = presentation === 'row'

  const input = (
    <KindRenderer
      spec={spec}
      value={value}
      onChange={set}
      onClear={() => {
        spec.handle.clear()
      }}
      size={SIZE[presentation]}
      className={WIDTH[presentation]}
    />
  )

  const badge = overrides && (
    <span data-slot="override-badge" title={title} className="inline-flex shrink-0">
      <Lozenge>{t('controls.local')}</Lozenge>
    </span>
  )

  const reset = (label: string, visible: boolean): ReactElement => (
    <button
      type="button"
      data-slot="override-reset"
      className={buttonVariants({ variant: 'ghost', size: visible ? 'sm' : 'icon' })}
      {...(!visible && { 'aria-label': label })}
      onClick={() => {
        spec.handle.clear()
      }}
    >
      {visible ? label : <ResetIcon />}
    </button>
  )

  if (row) {
    return (
      <div
        data-slot="control-view"
        data-source={source}
        data-presentation={presentation}
        className={cn('flex min-w-0 flex-col gap-1.5', className)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{spec.label}</span>
          {badge}
        </div>
        {input}
        {overrides && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p data-slot="override-note" className="min-w-0 text-xs text-muted-foreground">
              {title}
            </p>
            {reset(t('controls.useGlobal'), true)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-slot="control-view"
      data-source={source}
      data-presentation={presentation}
      className={cn('flex min-w-0 max-w-full flex-wrap items-center gap-1.5', className)}
    >
      {presentation === 'pill' && (
        <span className="shrink-0 text-xs text-muted-foreground">{spec.label}</span>
      )}
      {input}
      {badge}
      {overrides && reset(t('controls.resetToGlobal', spec.label), false)}
    </div>
  )
}
