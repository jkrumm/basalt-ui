---
name: Switch
use when: 'a setting turns on or off and takes effect at once'
never when: 'the choice is submitted with a form (use Checkbox), or there are more than two states (use RadioGroup or Select)'
subpath: basalt-ui/ui/switch
peers: ['@base-ui/react']
slots: [switch]
---

# Switch

An on/off switch on Base UI; Space toggles it. Works with no provider and joins a Base UI `Field`
when wrapped in one. Name it with a wrapping `<label>` or `aria-label`.

## Props

### `Switch`

```ts
Switch({ className, ...props }: SwitchProps): ReactElement
  className?: string  // Layout only (`mt-1`, `shrink-0`)
```

## `switchVariants`

Part `switch`.

No variant axes.

## Slots

- `switch`
