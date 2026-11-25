import { Input as BaseInput } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `FileUpload` drop-zone cva table: a dashed, bordered box that centres its icon, text and
 * hint. `data-dragging` lights the border and fill while a file is dragged over it; `data-disabled`
 * dims it. `compact` is the smaller zone shown under a chosen file in single mode. A coarse
 * pointer keeps the density's text size.
 *
 * @example
 * fileUploadVariants({ compact: true }) // class string for a hand-built drop zone
 */
export const fileUploadVariants = cva(
  'group flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-ctrl border border-dashed border-input bg-field px-4 text-center text-foreground focus-ring transition-colors data-invalid:border-bad data-dragging:border-brand data-dragging:bg-accent data-disabled:cursor-not-allowed data-disabled:opacity-50',
  {
    variants: {
      compact: {
        true: 'py-3 text-xs',
        false: 'py-6 text-sm',
      },
    },
    defaultVariants: { compact: false },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const fileUploadParts = ['file-upload'] as const

/** One file the part refused, with why: `type` (not in `accept`), `size` (over `maxSize`) or `count` (over `maxFiles`, or a second file in single mode). */
export type FileRejection = { file: File; reason: 'type' | 'size' | 'count' }

export type FileUploadProps = {
  /** The chosen files, to control the part. Pair with `onValueChange`. */
  value?: readonly File[]
  /** The files chosen at the start, when the part keeps its own list. */
  defaultValue?: readonly File[]
  /** Fires with the next list of accepted files (single mode: the one file; multiple: all of them). */
  onValueChange?: (files: File[]) => void
  /** MIME types, wildcards and extensions as the native attribute has them: `image/*,.pdf`. */
  accept?: string
  /** Allow more than one file; new files are appended and duplicates dropped. Default `false`. */
  multiple?: boolean
  /** The largest file in bytes. */
  maxSize?: number
  /** The most files in the list; only with `multiple`. */
  maxFiles?: number
  /** Fires with the files a choice or drop refused; the part also lists them under the zone. */
  onReject?: (rejections: readonly FileRejection[]) => void
  disabled?: boolean
  /** The limits line under the zone text. Derived from `accept`, `maxSize` and `maxFiles` when omitted; `null` hides it. */
  hint?: ReactNode
  /** Names the group; a Base UI `Field.Label` names the hidden input. */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** Joins the zone's description beside the hint and the rejection messages. */
  'aria-describedby'?: string
  /** Marks the zone invalid; a rejection also does. */
  'aria-invalid'?: boolean
  name?: string
  /** Layout only (`max-w-md`, `w-full`). Display belongs to the part. */
  className?: string
}

const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/** A byte count as `12 KB` or `5 MB`: one decimal at most, none when whole. */
function formatSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${Math.round(value * 10) / 10} ${UNITS[unit]}`
}

const acceptTokens = (accept: string | undefined): string[] =>
  (accept ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== '')

function matchesAccept(file: File, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

function tokenLabel(token: string): string {
  if (token.startsWith('.')) return token.slice(1).toUpperCase()
  const [kind = '', sub = ''] = token.split('/')
  if (sub === '*') return `${kind} files`
  const subtype = (sub.split('+')[0] ?? '').split('.').pop() ?? ''
  return subtype.toUpperCase()
}

/** `['pdf', '.png']` as `PDF or PNG`; empty when nothing is restricted. */
function typeLabel(tokens: readonly string[]): string {
  const labels = [...new Set(tokens.map(tokenLabel).filter((label) => label !== ''))]
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`
}

const plural = (n: number): string => (n === 1 ? '1 file' : `${n} files`)

const sameFile = (a: File, b: File): boolean =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

type Limits = {
  tokens: readonly string[]
  multiple: boolean
  maxSize: number | undefined
  maxFiles: number | undefined
}

/** Splits a choice into the files to keep and the ones to refuse; pure, so the handler stays flat. */
function sort(
  incoming: readonly File[],
  current: readonly File[],
  { tokens, multiple, maxSize, maxFiles }: Limits,
): { accepted: File[]; rejected: FileRejection[] } {
  const accepted: File[] = []
  const rejected: FileRejection[] = []
  const capacity = multiple ? (maxFiles ?? Infinity) : 1
  const room = multiple ? capacity - current.length : capacity
  for (const file of incoming) {
    if (!matchesAccept(file, tokens)) {
      rejected.push({ file, reason: 'type' })
      continue
    }
    if (maxSize !== undefined && file.size > maxSize) {
      rejected.push({ file, reason: 'size' })
      continue
    }
    if (multiple && [...current, ...accepted].some((kept) => sameFile(kept, file))) continue
    if (accepted.length >= room) {
      rejected.push({ file, reason: 'count' })
      continue
    }
    accepted.push(file)
  }
  return { accepted, rejected }
}

function describeRejection({ file, reason }: FileRejection, limits: Limits): string {
  if (reason === 'size') return `${file.name} is over ${formatSize(limits.maxSize ?? 0)}.`
  if (reason === 'count') {
    return `Only ${plural(limits.multiple ? (limits.maxFiles ?? 1) : 1)} can be added.`
  }
  const label = typeLabel(limits.tokens)
  return `${file.name} is not an accepted type${label === '' ? '' : ` (${label})`}.`
}

function derivedHint({ tokens, multiple, maxSize, maxFiles }: Limits): string {
  const parts = [typeLabel(tokens)]
  if (maxSize !== undefined) parts.push(`up to ${formatSize(maxSize)}${multiple ? ' each' : ''}`)
  if (multiple && maxFiles !== undefined) parts.push(`${plural(maxFiles)} at most`)
  return parts.filter((part) => part !== '').join(', ')
}

function UploadIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-5 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />
    </svg>
  )
}

function FileIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 1.5h5l3.5 3.5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM9 1.5V5h3.5" />
    </svg>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  )
}

/**
 * A file picker with a drop zone on Base UI's `Input` (the hidden `<input type="file">`, so it joins a
 * Base UI `Field`: the label, `name` and `disabled` reach the input). The zone is one button: Enter or
 * Space, or a click, opens the picker; dropping files on it adds them. Files are checked against
 * `accept`, `maxSize` and `maxFiles`: accepted ones go to `onValueChange`, refused ones to `onReject`
 * and, as a sentence naming the file and the limit, to a live region under the zone. Single mode
 * replaces the file and keeps a smaller "Replace file" zone; `multiple` appends and drops duplicates
 * (same name, size and modified time). Chosen files list below with a remove button each. The
 * hidden input is not role `textbox` or a visible control: find the zone by role `button`.
 *
 * @useWhen the user attaches files from disk (a document, an image, an import)
 * @neverWhen a file path or a URL typed as text (use Input), or uploading itself (the part holds no network state; show progress with Progress)
 * @example
 * <FileUpload
 *   aria-label="Invoice"
 *   accept="application/pdf,.png"
 *   maxSize={5 * 1024 * 1024}
 *   value={files}
 *   onValueChange={setFiles}
 * />
 */
export function FileUpload({
  value,
  defaultValue,
  onValueChange,
  accept,
  multiple = false,
  maxSize,
  maxFiles,
  onReject,
  disabled = false,
  hint,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
  name,
  className,
}: FileUploadProps): ReactElement {
  const [inner, setInner] = useState<readonly File[]>(defaultValue ?? [])
  const [rejections, setRejections] = useState<readonly FileRejection[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const errorsId = useId()
  const files = value ?? inner

  const limits: Limits = { tokens: acceptTokens(accept), multiple, maxSize, maxFiles }

  const commit = (next: readonly File[]): void => {
    if (value === undefined) setInner(next)
    onValueChange?.([...next])
  }

  const add = (incoming: readonly File[]): void => {
    if (disabled || incoming.length === 0) return
    const { accepted, rejected } = sort(incoming, files, limits)
    setRejections(rejected)
    if (rejected.length > 0) onReject?.(rejected)
    if (accepted.length === 0) return
    commit(multiple ? [...files, ...accepted] : accepted)
  }

  const remove = (target: File): void => {
    setRejections([])
    commit(files.filter((file) => file !== target))
  }

  const open = (): void => {
    const input = inputRef.current
    if (disabled || input === null) return
    // Clearing first lets the same file be chosen again: the input fires no change for an unchanged value.
    input.value = ''
    input.click()
  }

  const onDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    // Without this the browser opens the dropped file instead of firing drop.
    event.preventDefault()
    if (!disabled) setDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragging(false)
  }

  const onDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    setDragging(false)
    add(Array.from(event.dataTransfer.files))
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    add(Array.from(event.currentTarget.files ?? []))
  }

  const shownHint = hint === undefined ? derivedHint(limits) : hint
  const messages = [...new Set(rejections.map((rejection) => describeRejection(rejection, limits)))]
  const invalid = ariaInvalid === true || messages.length > 0
  const replacing = !multiple && files.length > 0
  const describedBy =
    [ariaDescribedby, shownHint ? hintId : undefined, errorsId].filter(Boolean).join(' ') ||
    undefined
  const named = ariaLabel !== undefined || ariaLabelledby !== undefined

  return (
    <div
      data-slot="file-upload"
      role={named ? 'group' : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      className={cn('flex w-full flex-col gap-2', className)}
    >
      <BaseInput
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={onInputChange}
      />
      <button
        type="button"
        data-file-upload="zone"
        aria-disabled={disabled || undefined}
        data-invalid={invalid ? '' : undefined}
        aria-describedby={describedBy}
        data-dragging={dragging ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={fileUploadVariants({ compact: replacing })}
        onClick={open}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <UploadIcon />
        <span>
          {replacing ? null : multiple ? 'Drop files here or ' : 'Drop a file here or '}
          <span className="font-medium text-brand group-hover:underline">
            {replacing ? 'Replace file' : 'browse'}
          </span>
        </span>
        {shownHint ? (
          <span id={hintId} data-file-upload="hint" className="text-xs text-muted-foreground">
            {shownHint}
          </span>
        ) : null}
      </button>
      <div
        id={errorsId}
        data-file-upload="errors"
        aria-live="polite"
        className="flex flex-col gap-1 text-xs text-bad empty:hidden"
      >
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
      {files.length > 0 ? (
        <ul data-file-upload="list" className="flex flex-col gap-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              data-file-upload="item"
              className="flex items-center gap-2 text-sm"
            >
              <FileIcon />
              <span className="min-w-0 flex-1 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatSize(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => remove(file)}
                className="relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-ctrl text-muted-foreground focus-ring transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
