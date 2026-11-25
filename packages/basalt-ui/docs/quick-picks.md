---
name: QuickPicks
use when: 'a field has a few common values worth one click: dates, durations, amounts'
never when: 'the pills are the field''s only values (use Segmented or RadioGroup) or there are more than about six'
subpath: basalt-ui/ui/quick-picks
peers: ['@base-ui/react']
slots: [quick-picks]
---

# QuickPicks

A row of shortcut pills that write one value into the field they sit with (Today, Tomorrow, In 3
days into a date input). It holds no value of its own: it shows a pill picked while the field
equals that pill's `value`, so typing a different value clears the pick. One tab stop, arrow keys
move through the pills. Compose it above or beside the field it feeds, in one `Field`.

## Props

### `QuickPicks`

```ts
QuickPicks({ options, value, onValueChange, disabled, className, ...names }: QuickPicksProps): ReactElement
  options: readonly QuickPick[]
  value?: string  // The field's current value: the pill whose `value` equals it is picked, none when it matches no pill
  onValueChange?: (value: string) => void  // Fires with the picked pill's `value`: write it into the field
  disabled?: boolean
  aria-label?: string
  aria-labelledby?: string
  className?: string  // Layout only (`mb-1`)
```

## `quickPicksVariants`

Part `quick-picks`.

No variant axes.

## Slots

- `quick-picks`
