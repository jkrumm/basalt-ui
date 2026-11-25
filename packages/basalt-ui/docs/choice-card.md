---
name: ChoiceCard
use when: 'a choice carries a description, a price or a picture and the options sit side by side'
never when: 'the options are plain one-line labels (use a RadioGroup or CheckboxGroup list)'
subpath: basalt-ui/ui/choice-card
peers: []
slots: [choice-card]
---

# ChoiceCard

A selectable card: a title, a line of text, an optional trailing value and an optional preview
slot around one `Radio` or `Checkbox`. The whole card is the `<label>`, so a click anywhere selects.
`RadioGroup` and `CheckboxGroup` draw `options` with it when their `variant` is `card` or `tile`;
use it directly when a card needs its own children.

## Props

### `ChoiceCard`

```ts
ChoiceCard({ control, label, description, trailing, preview, className, }: ChoiceCardProps): ReactElement
  control: ReactElement<unknown, string | React.JSXElementConstructor<any>>  // The `Radio` or `Checkbox` the card selects with
  label: ReactNode  // The card's title: the name of the choice
  description?: ReactNode  // One line under the title
  trailing?: ReactNode  // A value at the end of the title row (a price with its unit line); described to assistive tech
  preview?: ReactNode  // A picture above the title row: a thumbnail, a swatch strip, a mini layout
  className?: string  // Layout only (`w-full`, `max-w-sm`)
```

## `choiceCardVariants`

Part `choice-card`.

No variant axes.

## Slots

- `choice-card`
