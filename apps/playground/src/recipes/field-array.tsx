// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:field-array
import { useForm } from '@tanstack/react-form'
import { FormField, FormRow } from 'basalt-ui/controls'
import { Button } from 'basalt-ui/ui/button'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'

const blank = () => ({ id: crypto.randomUUID(), item: '', qty: 1 })

export function LinesForm({ onSave }: { onSave: (lines: ReturnType<typeof blank>[]) => void }) {
  const form = useForm({
    defaultValues: { lines: [blank()] },
    onSubmit: ({ value }) => onSave(value.lines),
  })
  return (
    <form.Field name="lines" mode="array">
      {(lines) => (
        <div className="flex flex-col gap-3">
          {lines.state.value.map((line, i) => (
            // The row's key is the id in the value: Form names rows by index (`lines[1].qty`).
            <FormRow key={line.id} legend={`Line ${i + 1}`}>
              <form.Field name={`lines[${i}].item`}>
                {(f) => (
                  <FormField label="Item" field={f}>
                    <Input />
                  </FormField>
                )}
              </form.Field>
              <form.Field name={`lines[${i}].qty`}>
                {(f) => (
                  <FormField label="Quantity" field={f}>
                    <NumberField min={1} />
                  </FormField>
                )}
              </form.Field>
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
// #endregion
