---
name: field-array
use-when: a form repeats a row of fields (lines, cameras, splits) that the person adds and removes
---

TanStack Form names a row by its index: `lines[1].qty`. Declare the array with `mode="array"` and edit it with `pushValue`, `removeValue`, `insertValue` and `moveValue`.
Keep a stable id in every row's value and use it as the React key. Keyed by index, removing row 0 hands its inputs to the next row, and focus and a half-typed value jump with it.
`FormRow` is the row and its `legend` names it for a screen reader (`Line 2`); it lays the fields side by side from its own container's `@regular` tier. The Remove button belongs to the row.
`useFormDraft` round-trips the array: rows added, removed and reordered restore in order, which is why the id lives in the value.

```tsx
import { FormRow } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { Button } from 'basalt-ui/ui/button'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'

const blank = () => ({ id: crypto.randomUUID(), item: '', qty: 1 })

export function LinesForm({ onSave }: { onSave: (lines: ReturnType<typeof blank>[]) => void }) {
  const form = useAppForm({
    defaultValues: { lines: [blank()] },
    onSubmit: ({ value }) => onSave(value.lines),
  })
  return (
    <form.Field name="lines" mode="array">
      {(lines) => (
        <div className="flex flex-col gap-3">
          {lines.state.value.map((line, i) => (
            <FormRow key={line.id} legend={`Line ${i + 1}`}>
              <form.AppField name={`lines[${i}].item`}>
                {(f) => (
                  <f.FormField label="Item">
                    <Input />
                  </f.FormField>
                )}
              </form.AppField>
              <form.AppField name={`lines[${i}].qty`}>
                {(f) => (
                  <f.FormField label="Quantity">
                    <NumberField min={1} />
                  </f.FormField>
                )}
              </form.AppField>
              <Button variant="secondary" className="self-end" onClick={() => lines.removeValue(i)}>
                Remove
              </Button>
            </FormRow>
          ))}
          <Button variant="secondary" onClick={() => lines.pushValue(blank())}>
            Add line
          </Button>
        </div>
      )}
    </form.Field>
  )
}
```
