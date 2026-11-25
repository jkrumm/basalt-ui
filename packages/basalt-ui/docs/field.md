---
name: Field
use when: 'a control needs a label, a description and an error that screen readers connect to it'
never when: 'the control is alone in a toolbar or a table cell (name it with `aria-label`), or the form uses FormField'
subpath: basalt-ui/ui/field
peers: ['@base-ui/react']
slots: [field, field-label, field-description, field-error, fieldset, fieldset-legend, form]
---

# Field

A labelled control with an optional description and an error, on Base UI's `Field`. Works with no
provider; a Base UI control inside it picks up the label, description and error on its own.

## Props

### `Field`

```ts
Field({ label, description, error, invalid, className, children, ...props }: FieldProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
  label: NonNullable<ReactNode>  // The visible name of the control
  description?: ReactNode  // Help text under the control, wired to it through `aria-describedby`
  error?: string  // An error as text
  children?: ReactNode  // The control: an `Input`, a `Select` trigger or any Base UI control
```

### `FieldLabel`

The label of a `Field`. Use it directly only when `Field`'s own layout does not fit.

```ts
FieldLabel({ className, ...props }: FieldLabelProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

### `FieldDescription`

The help text of a `Field`.

```ts
FieldDescription({ className, ...props }: FieldDescriptionProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

### `FieldError`

The error text of a `Field`. Without `match` it shows when the control's validity fails.

```ts
FieldError({ className, ...props }: FieldErrorProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

### `Fieldset`

A group of related fields under one legend.

```ts
Fieldset({ className, ...props }: FieldsetProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

### `FieldsetLegend`

The name of a `Fieldset`.

```ts
FieldsetLegend({ className, ...props }: FieldsetLegendProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

### `Form`

A form on Base UI: native validation wired to every `Field` inside it, `errors` from the server
and one `onFormSubmit` with the collected values.

```ts
Form<Values extends Record<string, unknown> = Record<string, unknown>>({ className, ...props }: FormProps<Values>): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

## `fieldVariants`

Part `field`.

No variant axes.

## `fieldsetVariants`

Part `fieldset`.

No variant axes.

## `formVariants`

Part `form`.

No variant axes.

## Slots

- `field`
- `field-label`
- `field-description`
- `field-error`
- `fieldset`
- `fieldset-legend`
- `form`
