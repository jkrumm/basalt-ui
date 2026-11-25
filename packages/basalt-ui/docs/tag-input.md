---
name: TagInput
use when: 'a list of free values the user types or pastes: emails to invite, keywords, domains'
never when: 'the values come from a known list (use Combobox multiple) or there is only one value (use Input)'
subpath: basalt-ui/ui/tag-input
peers: ['@base-ui/react']
slots: [tag-input]
---

# TagInput

Free values as removable chips inside one field. Enter, a typed separator or leaving the field
turns the typed text into a tag; Backspace on an empty entry removes the last tag; a pasted list
splits on the separators and line breaks. Duplicates are ignored. `validate` marks a failing tag
as an invalid chip and the entry `aria-invalid`. The entry is a Base UI input, so a wrapping
`Field` or `FormField` names and describes it. Controlled with `value` or uncontrolled.

## Props

### `TagInput`

```ts
TagInput({ value, defaultValue, onValueChange, validate, separators, max, placeholder, name, disabled, readOnly, "aria-invalid": invalidProp, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, autoComplete, inputMode, onBlur, className, }: TagInputProps): ReactElement
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: string[]) => void
  validate?: (tag: string) => string  // Checks one tag: return the message that says what is wrong, or nothing when it is fine
  separators?: string  // The characters that end a tag when typed and split a pasted list
  max?: number  // The most tags the field takes; further entries are dropped
  placeholder?: string
  name?: string  // Submits one value per tag under this name
  disabled?: boolean
  readOnly?: boolean
  aria-invalid?: boolean
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  autoComplete?: string  // `one-time-code`, `email`, `off`: the entry's `autoComplete`
  inputMode?: "search" | "text" | "numeric" | "email" | "url"
  onBlur?: () => void  // Fires once when focus leaves the field, after the pending text became a tag: the validate-on-blur hook
  className?: string  // Layout only (`w-full`, `max-w-md`)
```

## `tagInputVariants`

Part `tag-input`.

No variant axes.

## Slots

- `tag-input`
