// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:file-drop
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
// #endregion
