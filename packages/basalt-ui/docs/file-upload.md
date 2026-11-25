---
name: FileUpload
use when: 'the user attaches files from disk (a document, an image, an import)'
never when: 'a file path or a URL typed as text (use Input), or uploading itself (the part holds no network state; show progress with Progress)'
subpath: basalt-ui/ui/file-upload
peers: ['@base-ui/react']
slots: [file-upload]
---

# FileUpload

A file picker with a drop zone on Base UI's `Input` (the hidden `<input type="file">`, so it joins a
Base UI `Field`: the label, `name` and `disabled` reach the input). The zone is one button: Enter or
Space, or a click, opens the picker; dropping files on it adds them. Files are checked against
`accept`, `maxSize` and `maxFiles`: accepted ones go to `onValueChange`, refused ones to `onReject`
and, as a sentence naming the file and the limit, to a live region under the zone. Single mode
replaces the file and keeps a smaller "Replace file" zone; `multiple` appends and drops duplicates
(same name, size and modified time). Chosen files list below with a remove button each. The
hidden input is not role `textbox` or a visible control: find the zone by role `button`.

## Props

### `FileUpload`

```ts
FileUpload({ value, defaultValue, onValueChange, accept, multiple, maxSize, maxFiles, onReject, disabled, hint, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby, "aria-describedby": ariaDescribedby, "aria-invalid": ariaInvalid, name, className, }: FileUploadProps): ReactElement
  value?: readonly File[]  // The chosen files, to control the part
  defaultValue?: readonly File[]  // The files chosen at the start, when the part keeps its own list
  onValueChange?: (files: File[]) => void  // Fires with the next list of accepted files (single mode: the one file; multiple: all of them)
  accept?: string  // MIME types, wildcards and extensions as the native attribute has them: `image/*,.pdf`
  multiple?: boolean  // Allow more than one file; new files are appended and duplicates dropped
  maxSize?: number  // The largest file in bytes
  maxFiles?: number  // The most files in the list; only with `multiple`
  onReject?: (rejections: readonly FileRejection[]) => void  // Fires with the files a choice or drop refused; the part also lists them under the zone
  disabled?: boolean
  hint?: ReactNode  // The limits line under the zone text
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  aria-invalid?: boolean
  name?: string
  className?: string  // Layout only (`max-w-md`, `w-full`)
```

## `fileUploadVariants`

Part `file-upload`.

- `compact`: `true`, `false` (default `false`); not a prop of `FileUpload`, which resolves it itself

## Slots

- `file-upload`
