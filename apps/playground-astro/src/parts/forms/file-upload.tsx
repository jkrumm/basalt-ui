import { FileUpload } from 'basalt-ui/ui/file-upload'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <FileUpload
      aria-label="Import file"
      accept="text/csv,.csv"
      maxSize={5_000_000}
      hint="One CSV file, up to 5 MB."
      className="max-w-md"
    />
  )
}
