// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:field-array
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
// #endregion
