---
name: ModelPicker
use when: 'a person picks the model, or several to compare, that answers a prompt; it sits in the Composer''s footer through `model`'
never when: 'the choice is no model (use Select or Combobox from basalt-ui/ui)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: [model-picker, model-picker-content, model-picker-count]
---

# ModelPicker

A model picker: a quiet trigger naming the choice, a popup with a search, the models in their
groups with a check, and with `multiple` a footer counting the choice ("3 models selected").

## Signature

```ts
ModelPicker(props: ModelPickerProps): ReactElement
  // either multiple or neither
  multiple?: false | true
  value?: string | null | readonly string[]
  defaultValue?: string | null | readonly string[]
  onValueChange?: (value: string | null) => void | (value: string[]) => void
  aria-label: string
  options: ListSource<string>  // The models as options, grouped by provider or family (`{ label, options }`), or a loader
  rank?: RankFn<ListOption<string>>  // Orders and filters the models for the search text
  placeholder?: string  // Shown in the trigger while nothing is chosen
  disabled?: boolean
  className?: string  // Layout only (`ml-auto`)
```

`ModelPickerProps` import from `basalt-ui/ai`: `import type { ModelPickerProps } from 'basalt-ui/ai'`.

## Example

```tsx
<ModelPicker aria-label="Model" options={[{ label: 'Anthropic', options: [{ value: 'opus', label: 'Opus' }] }]} value={model} onValueChange={setModel} />
```
