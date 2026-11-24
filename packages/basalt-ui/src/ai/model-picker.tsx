/**
 * `ModelPicker`: which model (or models) answers, on the list engine. Base UI's Combobox with the
 * search inside the popup, the engine's grouped rows and checks, and a count footer when several may
 * be chosen. The models are `ListOption`s the app passes; nothing here knows a provider.
 */
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider } from '../core/control-scope'
import { OptionListBody, useListRoot } from '../core/list/engine'
import type { ListOption, ListSource } from '../core/list/options'
import { defaultRank } from '../core/list/rank'
import type { RankFn } from '../core/list/rank'
import { ai } from '../core/messages/ai'
import { useMessages } from '../core/messages/use-messages'
import { buttonVariants } from '../ui/button'
import { ChevronGlyph } from './glyphs'

type Single = {
  multiple?: false
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
}

type Multiple = {
  multiple: true
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: string[]) => void
}

export type ModelPickerProps = (Single | Multiple) & {
  /** Names the trigger: "Model". */
  'aria-label': string
  /** The models as options, grouped by provider or family (`{ label, options }`), or a loader. */
  options: ListSource<string>
  /** Orders and filters the models for the search text. Default `defaultRank`. */
  rank?: RankFn<ListOption<string>> | undefined
  /** Shown in the trigger while nothing is chosen. */
  placeholder?: string
  disabled?: boolean
  /** Layout only (`ml-auto`). */
  className?: string
}

/**
 * A model picker: a quiet trigger naming the choice, a popup with a search, the models in their
 * groups with a check, and with `multiple` a footer counting the choice ("3 models selected").
 *
 * @useWhen a person picks the model, or several to compare, that answers a prompt; it sits in the Composer's footer through `model`
 * @neverWhen the choice is no model (use Select or Combobox from basalt-ui/ui)
 *
 * @example
 * <ModelPicker aria-label="Model" options={[{ label: 'Anthropic', options: [{ value: 'opus', label: 'Opus' }] }]} value={model} onValueChange={setModel} />
 */
export function ModelPicker(props: ModelPickerProps): ReactElement {
  const { options, rank, placeholder, disabled, className, multiple } = props
  const t = useMessages(ai)
  const label = props['aria-label']
  const { list, highlight, selectedIndex, virtual, root } = useListRoot({
    options: options as ListSource<unknown>,
    rank: (rank ?? defaultRank) as RankFn<ListOption<unknown>>,
    multiple: multiple === true,
    value: props.value,
    defaultValue: props.defaultValue,
    onValueChange: props.onValueChange,
    searchInPopup: true,
  })
  const chosen: readonly unknown[] = Array.isArray(root.value)
    ? root.value
    : root.value === null || root.value === undefined
      ? []
      : [root.value]
  const first = chosen[0]
  return (
    <BaseCombobox.Root
      {...(root as Omit<BaseCombobox.Root.Props<unknown, boolean>, 'items'>)}
      items={root.items}
      disabled={disabled}
      autoHighlight
    >
      <BaseCombobox.Trigger
        aria-label={label}
        data-slot="model-picker"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'max-w-48', className)}
      >
        {first === undefined ? (
          <span className="truncate text-muted-foreground">{placeholder ?? label}</span>
        ) : (
          <span className="truncate">
            {chosen.length > 1 ? t('ai.models', chosen.length) : list.textOf(first)}
          </span>
        )}
        <span className="text-muted-foreground">
          <ChevronGlyph open />
        </span>
      </BaseCombobox.Trigger>
      <ControlScopeProvider value={null}>
        <BaseCombobox.Portal>
          <BaseCombobox.Positioner sideOffset={4} align="start" className="z-50 outline-none">
            <BaseCombobox.Popup
              data-slot="model-picker-content"
              className="flex max-h-(--available-height) w-72 flex-col overflow-hidden rounded-ctrl border border-border bg-popover shadow-overlay outline-none"
            >
              <div className="border-b border-border p-1">
                <BaseCombobox.Input
                  aria-label={t('ai.modelSearch')}
                  placeholder={t('ai.modelSearch')}
                  className="h-ctl w-full rounded-chip bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-faint"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                <OptionListBody
                  list={list}
                  size="md"
                  kind="combobox"
                  highlight={highlight}
                  virtual={virtual}
                  selectedIndex={selectedIndex}
                />
              </div>
              {multiple === true && (
                <output
                  data-slot="model-picker-count"
                  className="border-t border-border px-3 py-2 text-xs text-muted-foreground tabular-nums"
                >
                  {t('ai.modelsSelected', chosen.length)}
                </output>
              )}
            </BaseCombobox.Popup>
          </BaseCombobox.Positioner>
        </BaseCombobox.Portal>
      </ControlScopeProvider>
    </BaseCombobox.Root>
  )
}
