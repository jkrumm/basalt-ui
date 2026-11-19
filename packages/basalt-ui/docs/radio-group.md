---
name: RadioGroup
use when: 'one value of a few (up to about five) that the user should see all at once'
never when: 'more than about five options (use Select), several values at once (use Checkbox), or a view switch (use Segmented)'
subpath: basalt-ui/ui/radio-group
peers: ['@base-ui/react']
slots: [radio-group, radio]
---

# RadioGroup

A group of radios on Base UI: one selected value, arrow keys move it in DOM order. Works with no
provider and joins a Base UI `Field` when wrapped in one. Name each radio with a wrapping
`<label>`, or give `options` and each row is labelled and described for you.

## Props

### `RadioGroup`

A group of radios on Base UI: one selected value, arrow keys move it in DOM order. Works with no
provider and joins a Base UI `Field` when wrapped in one. Name each radio with a wrapping
`<label>`, or give `options` and each row is labelled and described for you.

```ts
RadioGroup<Value = string>({ className, options, children, ...props }: RadioGroupProps<Value>): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
  options?: readonly ChoiceOption<Value>[]  // The choices, each a row with its label and description
```

### `Radio`

One option of a `RadioGroup`. Its selected dot is drawn by the part; children are not accepted.

```ts
Radio<Value = string>({ className, ...props }: RadioProps<Value>): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

## `radioGroupVariants`

Part `radio-group`.

No variant axes.

## `radioVariants`

Part `radio`.

No variant axes.

## Slots

- `radio-group`
- `radio`
