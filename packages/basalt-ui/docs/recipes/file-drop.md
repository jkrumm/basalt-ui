---
name: file-drop
use-when: a form takes a file from the person, by a picker first and by dropping onto the page as an enhancement
file: apps/playground/src/recipes/file-drop.tsx
---

There is no upload primitive: the transport, progress and limits are the app's. The recipe is the picker.
The picker is a `Button` rendered as a `<label>` (`nativeButton={false}`) around a visually hidden `<input type="file">`. The button is focusable and Enter or Space opens the dialog, so a keyboard and a screen reader never need the drop.
`label` is a required string: it names the control. Dropping is an enhancement on the wrapper, and `data-over` is the only state it draws.
The recipe hands back `File[]` and holds none of them: validate the type and size where the app decides, and show the failure through the form's error.

```tsx
import { Button } from 'basalt-ui/ui/button'
import { useState } from 'react'
import type { DragEvent, ReactElement } from 'react'

/** The label is required: it names the picker for a screen reader as well as for the eye. */
export function FileDrop(p: {
  label: string
  accept?: string
  onFiles: (files: File[]) => void
}): ReactElement {
  const [over, setOver] = useState(false)
  const drop = (event: DragEvent): void => {
    event.preventDefault()
    setOver(false)
    p.onFiles([...event.dataTransfer.files])
  }
  return (
    <div
      data-over={over || undefined}
      className="rounded-ctrl border border-dashed border-input p-4 data-over:bg-muted"
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- the label is the Button's render target; its text and the input inside are its children */}
      <Button variant="secondary" nativeButton={false} render={<label />}>
        {p.label}
        {/* theme-allow raw-form-control — the input is never painted: it is visually hidden and the label's button is the control */}
        <input
          type="file"
          multiple
          className="sr-only"
          {...(p.accept !== undefined && { accept: p.accept })}
          onChange={(event) => p.onFiles([...(event.currentTarget.files ?? [])])}
        />
      </Button>
    </div>
  )
}
```
