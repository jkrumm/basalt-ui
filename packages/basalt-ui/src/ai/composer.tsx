/**
 * `Composer`: the message box of a chat, and of anything else that sends a written message. Plain
 * text, no editor: the draft is a textarea that grows to a cap and then scrolls, and a mention is a
 * typed token over a range of that text (`mention-text.ts`), returned beside it on send.
 *
 * Enter sends and Shift+Enter breaks the line; the Enter that confirms an IME candidate never sends.
 * The draft clears at once and comes back when `onSend` throws or rejects, unless the person has
 * typed something newer. While `status` is `submitted` or `streaming` the send button is a stop
 * button calling `onStop`, and Enter sends nothing. It owns no chat: `status` and `onStop` are the
 * app's `useChat` values, passed in.
 *
 * Mentions: `@` typed at a word start (or the `@` button) opens the list engine's rows for the text
 * after it, grouped and from a loader alike, in a popover at the caret. Focus stays in the textarea:
 * arrows move the highlight (`aria-activedescendant`), Enter or Tab picks, Escape closes the list
 * and nothing else.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useOptionList } from '../core/list/engine'
import {
  ListStatusRow,
  OptionRowBody,
  groupLabelVariants,
  optionRowVariants,
} from '../core/list/option-row'
import type { ListOption, ListRow, ListSource } from '../core/list/options'
import { defaultRank } from '../core/list/rank'
import type { RankFn } from '../core/list/rank'
import { ai } from '../core/messages/ai'
import { useMessages } from '../core/messages/use-messages'
import type { IconComponent } from '../core/ports'
import { Button } from '../ui/button'
import { FileUpload } from '../ui/file-upload'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { caretRect } from './caret'
import { AtGlyph, CloseGlyph, FileGlyph, PlusGlyph, SendGlyph, StopGlyph } from './glyphs'
import { insertMention, mentionQuery, rebaseMentions } from './mention-text'
import type { Mention, MentionQuery } from './mention-text'
import { ModelPicker } from './model-picker'
import type { ModelPickerProps } from './model-picker'

export type { Mention } from './mention-text'

/** The chat's state as `useChat` reports it; `submitted` and `streaming` show the stop button. */
export type ComposerStatus = 'ready' | 'submitted' | 'streaming' | 'error'

/** What a send hands the app: the trimmed text, its mentions (ranges in that text) and the files. */
export type ComposerMessage<Value = unknown> = {
  text: string
  mentions: readonly Mention<Value>[]
  files: readonly File[]
}

/** One entry of the add menu: typed data, like a page action. */
export type ComposerAddItem = {
  id: string
  label: string
  icon?: IconComponent | undefined
  onSelect: () => void
}

/** What `@` lists: options and groups (`{ label, options }`) or a loader `(query, { signal })`. */
export type ComposerMentions<Value = unknown> = {
  source: ListSource<Value>
  /** Orders and filters a static list for the typed text. Default `defaultRank`. */
  rank?: RankFn<ListOption<Value>> | undefined
}

/** Files the add menu takes through `FileUpload`; the limits are its own. */
export type ComposerFiles = {
  accept?: string
  maxSize?: number
  maxFiles?: number
}

export type ComposerProps<Value = unknown> = {
  /** Names the text box: "Message". */
  'aria-label': string
  /** Sends the message. A throw or a rejection gives the draft back. */
  onSend: (message: ComposerMessage<Value>) => unknown
  /** `useChat`'s status; `submitted` and `streaming` turn send into stop. Default `ready`. */
  status?: ComposerStatus
  /** `useChat`'s `stop`. */
  onStop?: () => void
  placeholder?: string
  /** The draft at mount. */
  defaultValue?: string
  /** Turns on `@` mentions over these options. */
  mentions?: ComposerMentions<Value>
  /** The add menu's entries. */
  add?: readonly ComposerAddItem[]
  /** Turns on attachments through the add menu. */
  files?: ComposerFiles
  /** A model picker in the footer. */
  model?: ModelPickerProps
  disabled?: boolean
  /** Layout only (`w-full`, `max-w-3xl`). */
  className?: string
}

/** Every `data-slot` this module renders. */
export const composerParts = [
  'composer',
  'composer-input',
  'composer-files',
  'composer-footer',
  'composer-mentions',
] as const

type Draft<Value> = { text: string; tokens: readonly Mention<Value>[] }

const isPromise = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function'

/** The engine's option rows a key can reach: never a header, never a disabled option. */
function pickable<Value>(rows: readonly ListRow<Value>[]): ListOption<Value>[] {
  return rows.flatMap((row) =>
    row.kind === 'option' && row.option.disabled !== true ? [row.option] : [],
  )
}

/**
 * A message box: a growing textarea over a footer of add, mention, model and send. Text, mentions
 * and files come back to `onSend` as data.
 *
 * @useWhen a person writes a message that is sent: a chat prompt, a reply, a mail body
 * @neverWhen the text is a field of a form that saves with the form (use Textarea), or a search box (use Input)
 *
 * @example
 * const { status, stop, sendMessage } = useChat({ chat })
 * <Composer aria-label="Message" status={status} onStop={stop} onSend={({ text }) => sendMessage({ text })} />
 */
export function Composer<Value = unknown>({
  'aria-label': label,
  onSend,
  status = 'ready',
  onStop,
  placeholder,
  defaultValue = '',
  mentions,
  add,
  files: fileRules,
  model,
  disabled = false,
  className,
}: ComposerProps<Value>): ReactElement {
  const t = useMessages(ai)
  const listId = useId()
  const area = useRef<HTMLTextAreaElement | null>(null)
  const [draft, setDraft] = useState<Draft<Value>>({ text: defaultValue, tokens: [] })
  const [files, setFiles] = useState<readonly File[]>([])
  const [caret, setCaret] = useState(defaultValue.length)
  const [dismissed, setDismissed] = useState<number | undefined>(undefined)
  const [active, setActive] = useState(0)
  const nextCaret = useRef<number | null>(null)
  const busy = status === 'submitted' || status === 'streaming'

  const found = mentions === undefined ? undefined : mentionQuery(draft.text, caret, draft.tokens)
  const query: MentionQuery | undefined = found?.start === dismissed ? undefined : found
  const open = query !== undefined
  const list = useOptionList<Value>({
    source: mentions?.source ?? [],
    query: query?.query ?? '',
    open,
    rank: mentions?.rank ?? defaultRank,
  })
  const options = pickable(list.rows)
  const highlighted = options.length === 0 ? -1 : Math.min(active, options.length - 1)

  useLayoutEffect(() => {
    const at = nextCaret.current
    if (at === null || area.current === null) return
    nextCaret.current = null
    area.current.setSelectionRange(at, at)
    area.current.focus()
  })

  const edit = (text: string, at: number): void => {
    setDraft((before) => ({ text, tokens: rebaseMentions(before.tokens, before.text, text) }))
    setCaret(at)
    setActive(0)
    if (dismissed !== undefined && (text[dismissed] !== '@' || at <= dismissed))
      setDismissed(undefined)
  }

  const pick = (option: ListOption<Value>): void => {
    if (query === undefined) return
    const next = insertMention({
      text: draft.text,
      tokens: draft.tokens,
      start: query.start,
      caret,
      value: option.value,
      label: list.textOf(option.value),
    })
    setDraft({ text: next.text, tokens: next.tokens })
    setCaret(next.caret)
    nextCaret.current = next.caret
  }

  const send = (): void => {
    const text = draft.text.trim()
    if (busy || disabled || (text === '' && files.length === 0)) return
    const lead = draft.text.length - draft.text.trimStart().length
    const message: ComposerMessage<Value> = {
      text,
      mentions: draft.tokens.map((token) => ({
        ...token,
        start: token.start - lead,
        end: token.end - lead,
      })),
      files,
    }
    const kept = { draft, files }
    setDraft({ text: '', tokens: [] })
    setFiles([])
    setCaret(0)
    setDismissed(undefined)
    // A newer edit wins over the stale restore.
    const restore = (): void => {
      setDraft((now) => (now.text === '' ? kept.draft : now))
      setFiles((now) => (now.length === 0 ? kept.files : now))
    }
    try {
      const result = onSend(message)
      if (isPromise(result)) result.then(undefined, restore)
    } catch {
      restore()
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // An IME's confirming Enter: `isComposing`, and 229 where Safari ends composition first.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (options.length === 0) return
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((highlighted + step + options.length) % options.length)
        return
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
        const option = options[highlighted]
        if (option === undefined) return
        event.preventDefault()
        pick(option)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setDismissed(query.start)
        return
      }
    }
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
      return
    }
    event.preventDefault()
    send()
  }

  const openMention = (): void => {
    const el = area.current
    if (el === null) return
    const at = el.selectionStart
    const before = draft.text.slice(0, at)
    const insert = before === '' || /\s$/.test(before) ? '@' : ' @'
    const text = `${before}${insert}${draft.text.slice(el.selectionEnd)}`
    edit(text, at + insert.length)
    nextCaret.current = at + insert.length
  }

  const anchor = {
    getBoundingClientRect: (): DOMRect =>
      area.current === null || query === undefined
        ? new DOMRect()
        : caretRect(area.current, query.start),
  }
  const optionId = (at: number): string => `${listId}-${at}`
  const hasFiles = fileRules !== undefined
  const hasAdd = (add !== undefined && add.length > 0) || hasFiles

  return (
    <div
      data-slot="composer"
      data-status={status}
      className={cn(
        // The box draws the one ring of its text box, as a combobox draws the ring of its input.
        'flex flex-col gap-2 rounded-card border border-border bg-background p-2.5 has-[>textarea:focus-visible]:outline-2 has-[>textarea:focus-visible]:outline-offset-2 has-[>textarea:focus-visible]:outline-brand has-[>textarea:focus-visible]:outline-solid',
        disabled && 'opacity-50',
        className,
      )}
    >
      {files.length > 0 && (
        <ul
          data-slot="composer-files"
          aria-label={t('ai.composerFiles')}
          className="flex flex-wrap gap-1.5"
        >
          {files.map((file, at) => (
            <li
              key={`${file.name}-${at}`}
              className="flex h-6 max-w-56 items-center gap-1 rounded-chip border border-border bg-inset pl-1.5 text-xs"
            >
              <FileGlyph />
              <span className="min-w-0 truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label={`${t('ai.composerRemoveFile')} ${file.name}`}
                onClick={() => setFiles((now) => now.filter((_, i) => i !== at))}
              >
                <CloseGlyph />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={area}
        data-slot="composer-input"
        aria-label={label}
        aria-autocomplete={mentions === undefined ? undefined : 'list'}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && highlighted >= 0 ? optionId(highlighted) : undefined}
        rows={1}
        value={draft.text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => edit(event.currentTarget.value, event.currentTarget.selectionStart)}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className="block field-sizing-content max-h-50 min-h-12 w-full resize-none overflow-y-auto bg-transparent px-1 text-sm leading-6 text-foreground outline-none placeholder:text-faint"
      />
      <div data-slot="composer-footer" className="flex min-h-8 items-center gap-1">
        {hasAdd && (
          <AddMenu items={add ?? []} files={fileRules} attached={files} onFiles={setFiles} />
        )}
        {mentions !== undefined && (
          <Button
            variant="ghost"
            shape="icon"
            aria-label={t('ai.composerMention')}
            disabled={disabled}
            onClick={openMention}
          >
            <AtGlyph />
          </Button>
        )}
        {model !== undefined && <ModelPicker {...model} />}
        <span className="ml-auto" />
        {busy ? (
          <Button
            variant="secondary"
            shape="icon"
            aria-label={t('ai.composerStop')}
            onClick={() => onStop?.()}
          >
            <StopGlyph />
          </Button>
        ) : (
          <Button
            variant="primary"
            shape="icon"
            aria-label={t('ai.composerSend')}
            disabled={disabled || (draft.text.trim() === '' && files.length === 0)}
            onClick={send}
          >
            <SendGlyph />
          </Button>
        )}
      </div>
      {mentions !== undefined && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (!next && query !== undefined) setDismissed(query.start)
          }}
        >
          <PopoverContent
            aria-label={t('ai.mentions')}
            anchor={anchor}
            side="top"
            align="start"
            initialFocus={false}
            finalFocus={false}
            className="w-64 p-1"
          >
            <MentionRows
              id={listId}
              rows={list.rows}
              status={list.status}
              error={list.error}
              highlighted={highlighted}
              optionId={optionId}
              onHighlight={setActive}
              onPick={pick}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function MentionRows<Value>({
  id,
  rows,
  status,
  error,
  highlighted,
  optionId,
  onHighlight,
  onPick,
}: {
  id: string
  rows: readonly ListRow<Value>[]
  status: 'ready' | 'loading' | 'error'
  error: unknown
  highlighted: number
  optionId: (at: number) => string
  onHighlight: (at: number) => void
  onPick: (option: ListOption<Value>) => void
}): ReactElement {
  const pickIndex = new Map<string, number>()
  for (const row of rows) {
    if (row.kind === 'option' && row.option.disabled !== true)
      pickIndex.set(row.key, pickIndex.size)
  }
  const body: ReactNode[] = rows.map((row) => {
    if (row.kind === 'header') {
      return (
        <div key={row.key} role="presentation" className={groupLabelVariants({ size: 'md' })}>
          {row.label}
        </div>
      )
    }
    if (row.kind !== 'option') return null
    const { option } = row
    const disabled = option.disabled === true
    const index = pickIndex.get(row.key) ?? -1
    return (
      // The keys live on the textarea (`aria-activedescendant`), so a row is never focused and
      // carries no key handler of its own (ARIA APG combobox).
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- the keys live on the textarea
      <div
        key={row.key}
        id={index >= 0 ? optionId(index) : undefined}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an activedescendant option, which a native option cannot be
        role="option"
        tabIndex={-1}
        aria-selected={index === highlighted}
        aria-disabled={disabled || undefined}
        data-highlighted={index === highlighted ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={optionRowVariants({ size: 'md' })}
        // The textarea keeps focus: a press on a row picks it without blurring the draft.
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => index >= 0 && index !== highlighted && onHighlight(index)}
        onClick={() => !disabled && onPick(option)}
      >
        <OptionRowBody option={option} size="md" />
      </div>
    )
  })
  return (
    <div data-slot="composer-mentions" className="flex max-h-96 flex-col overflow-y-auto">
      <ListStatusRow status={status} error={error} hasRows={rows.length > 0} size="md" />
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the popup of a textarea combobox, which a select or datalist cannot be */}
      <div id={id} role="listbox" className="flex flex-col">
        {body}
      </div>
    </div>
  )
}

function AddMenu({
  items,
  files,
  attached,
  onFiles,
}: {
  items: readonly ComposerAddItem[]
  files: ComposerFiles | undefined
  /** The files already attached: `FileUpload` checks the count and duplicates against them. */
  attached: readonly File[]
  onFiles: (files: readonly File[]) => void
}): ReactElement {
  const t = useMessages(ai)
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" shape="icon" aria-label={t('ai.composerAdd')} />}
      >
        <PlusGlyph />
      </PopoverTrigger>
      <PopoverContent
        aria-label={t('ai.composerAdd')}
        side="top"
        align="start"
        className="flex w-72 flex-col gap-1 p-1"
      >
        {items.map(({ id, label, icon: Icon, onSelect }) => (
          <Button
            key={id}
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setOpen(false)
              onSelect()
            }}
          >
            {Icon !== undefined && (
              <Icon className="size-icon shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            {label}
          </Button>
        ))}
        {files !== undefined && (
          <FileUpload
            aria-label={t('ai.composerAttach')}
            multiple
            value={attached}
            {...(files.accept !== undefined && { accept: files.accept })}
            {...(files.maxSize !== undefined && { maxSize: files.maxSize })}
            {...(files.maxFiles !== undefined && { maxFiles: files.maxFiles })}
            onValueChange={(next) => {
              const added = next.length > attached.length
              onFiles(next)
              if (added) setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
