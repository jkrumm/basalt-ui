import { Button as BaseButton } from '@base-ui/react/button'
import { Input as BaseInput } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import { useRef, useState } from 'react'
import type { ClipboardEvent, FocusEvent, KeyboardEvent, ReactElement } from 'react'
import { cn } from '../core/cn'
import { base as baseMessages } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'

/**
 * The `TagInput` cva table: the field box the chips and the entry share. It looks like an `Input`
 * (one control high, growing as the chips wrap), outlines on focus anywhere inside and turns red
 * when the entry is invalid. A coarse pointer gets the 44 px floor and 16 px text.
 *
 * @example
 * tagInputVariants() // class string for a hand-built field box
 */
export const tagInputVariants = cva(
  'flex min-h-ctl w-full min-w-0 cursor-text flex-wrap items-center gap-1 rounded-ctrl border border-input bg-background px-1.5 py-0.5 text-sm text-foreground transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand has-aria-invalid:border-bad has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 pointer-coarse:py-0 pointer-coarse:text-base',
)

/**
 * The chip: one value with a remove button. An invalid chip keeps its place with a red ring so a
 * pasted list shows which entries failed.
 */
const tagChipVariants = cva(
  'inline-flex h-5 max-w-full items-center gap-1 rounded-chip bg-accent pr-0.5 pl-2 text-xs text-foreground data-invalid:bg-bad-tint data-invalid:pl-1.5 data-invalid:ring-1 data-invalid:ring-bad',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const tagInputParts = ['tag-input'] as const

export type TagInputProps = {
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: string[]) => void
  /**
   * Checks one tag: return the message that says what is wrong, or nothing when it is fine. A tag
   * that fails stays as an invalid chip (the entry turns `aria-invalid`); it is never dropped.
   */
  validate?: (tag: string) => string | undefined
  /** The characters that end a tag when typed and split a pasted list. Default `,;` and a line break. */
  separators?: string
  /** The most tags the field takes; further entries are dropped. */
  max?: number
  placeholder?: string
  /** Submits one value per tag under this name. */
  name?: string
  disabled?: boolean
  readOnly?: boolean
  /** Marks the entry invalid from outside (a server error). */
  'aria-invalid'?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  /** `one-time-code`, `email`, `off`: the entry's `autoComplete`. */
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'url' | 'numeric' | 'search'
  /** Fires once when focus leaves the field, after the pending text became a tag: the validate-on-blur hook. */
  onBlur?: () => void
  /** Layout only (`w-full`, `max-w-md`). */
  className?: string
}

const escape = (chars: string): string => chars.replaceAll(/[\\\]\-^]/g, String.raw`\$&`)

/**
 * Free values as removable chips inside one field. Enter, a typed separator or leaving the field
 * turns the typed text into a tag; Backspace on an empty entry removes the last tag; a pasted list
 * splits on the separators and line breaks. Duplicates are ignored. `validate` marks a failing tag
 * as an invalid chip and the entry `aria-invalid`. The entry is a Base UI input, so a wrapping
 * `Field` or `FormField` names and describes it. Controlled with `value` or uncontrolled.
 *
 * @useWhen a list of free values the user types or pastes: emails to invite, keywords, domains
 * @neverWhen the values come from a known list (use Combobox multiple) or there is only one value (use Input)
 * @example
 * <TagInput aria-label="Invitees" value={emails} onValueChange={setEmails}
 *   validate={(tag) => (tag.includes('@') ? undefined : 'Not an email')} inputMode="email" />
 */
export function TagInput({
  value,
  defaultValue,
  onValueChange,
  validate,
  separators = ',;',
  max,
  placeholder,
  name,
  disabled = false,
  readOnly = false,
  'aria-invalid': invalidProp = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  autoComplete = 'off',
  inputMode,
  onBlur,
  className,
}: TagInputProps): ReactElement {
  const t = useMessages(baseMessages)
  const entry = useRef<HTMLInputElement>(null)
  const [inner, setInner] = useState<readonly string[]>(defaultValue ?? [])
  const [draft, setDraft] = useState('')
  const tags = value ?? inner
  const split = new RegExp(`[${escape(separators)}\\r\\n\\t]+`)
  const problems = tags.map((tag) => validate?.(tag))
  const invalid = invalidProp || problems.some((problem) => problem !== undefined)

  const change = (next: readonly string[]): void => {
    setInner(next)
    onValueChange?.([...next])
  }
  /** Adds the non-empty, new pieces, up to `max`. */
  const add = (pieces: readonly string[]): void => {
    const next = [...tags]
    for (const piece of pieces) {
      const tag = piece.trim()
      if (tag === '' || next.includes(tag)) continue
      if (max !== undefined && next.length >= max) break
      next.push(tag)
    }
    if (next.length !== tags.length) change(next)
  }
  const remove = (index: number): void => {
    change(tags.filter((_, i) => i !== index))
    entry.current?.focus()
  }

  const onType = (text: string): void => {
    if (!split.test(text)) {
      setDraft(text)
      return
    }
    const parts = text.split(split)
    setDraft(parts.pop() ?? '')
    add(parts)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter' && draft.trim() !== '') {
      event.preventDefault()
      add([draft])
      setDraft('')
      return
    }
    if (event.key === 'Backspace' && draft === '' && tags.length > 0 && !readOnly) {
      change(tags.slice(0, -1))
    }
  }
  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text')
    if (!split.test(text)) return
    event.preventDefault()
    add((draft + text).split(split))
    setDraft('')
  }
  const onFocusOut = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return
    if (draft.trim() !== '') add([draft])
    setDraft('')
    onBlur?.()
  }

  return (
    // The box only forwards a click to the entry and the blur of the whole field.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- pointer and blur delegation for the entry
    <div
      data-slot="tag-input"
      {...(disabled && { 'data-disabled': '' })}
      className={cn(tagInputVariants(), className)}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        entry.current?.focus()
      }}
      onBlur={onFocusOut}
    >
      {tags.map((tag, index) => {
        const problem = problems[index]
        return (
          <span
            key={tag}
            data-chip=""
            {...(problem !== undefined && { 'data-invalid': '' })}
            className={tagChipVariants()}
          >
            {problem !== undefined && (
              <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 4.75v3.75M8 11v.01"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span className="truncate">{tag}</span>
            {problem !== undefined && <span className="sr-only">{problem}</span>}
            {!readOnly && (
              <BaseButton
                disabled={disabled}
                aria-label={t('base.tags.remove', tag)}
                className="relative inline-flex size-4 cursor-pointer items-center justify-center rounded-chip text-muted-foreground hover:bg-selected after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11"
                onClick={() => remove(index)}
              >
                <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </BaseButton>
            )}
            {name !== undefined && <input type="hidden" name={name} value={tag} />}
          </span>
        )
      })}
      <BaseInput
        ref={entry}
        value={draft}
        onValueChange={onType}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        placeholder={tags.length === 0 ? placeholder : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        {...(inputMode !== undefined && { inputMode })}
        className="h-6 min-w-16 flex-1 bg-transparent px-1 text-foreground outline-none placeholder:text-faint pointer-coarse:h-11"
      />
    </div>
  )
}
