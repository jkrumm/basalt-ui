/**
 * `MailThread`: one conversation in a mailbox's reader. Every message but the open one is a single
 * row (face, sender, preview, day); one opens at a time, the latest at first; an open message shows
 * its body and its attachments as file cards, and the reply sits at the foot.
 */
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'
import { lists } from '../core/messages/lists'
import { useMessages } from '../core/messages/use-messages'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion'
import { Avatar } from '../ui/avatar'
import type { AvatarEntry } from '../ui/avatar'
import { buttonVariants } from '../ui/button'
import { faceOf } from './mail-list'

/** A file sent with a message. */
export type MailAttachment = {
  name: string
  /** The file's kind as the reader names it: `PDF`, `XLSX`. */
  kind: string
  /** The size in bytes. */
  size: number
  /** Where it downloads from; without it the card has no download button. */
  href?: string | undefined
}

/** One message of the conversation. */
export type MailMessage = {
  /** Unique and stable within the thread. */
  id: string
  from: AvatarEntry & {
    /** The sender's address, printed beside the name once the message is open. */
    address?: string | undefined
  }
  /** Who it went to, as the reader should read it: `to me`, `to Purchasing`. */
  to?: string | undefined
  at: Date | number
  /** Plain text; line breaks are kept. */
  body: string
  /** The line a closed message shows. Default the body's first line that is not empty. */
  preview?: string | undefined
  attachments?: readonly MailAttachment[] | undefined
}

export type MailThreadProps = {
  /** Names the thread for assistive tech: the subject. */
  label: string
  /** Oldest first. */
  messages: readonly MailMessage[]
  /** The message open at first. Default the latest. */
  defaultOpen?: string | undefined
  /** The reply at the thread's foot: the reply buttons, or an open composer. */
  reply?: ReactNode
}

function size(f: ReturnType<typeof useFormat>, bytes: number): string {
  if (bytes < 1024) return f.number(bytes, { style: 'unit', unit: 'byte', unitDisplay: 'short' })
  const kb = bytes / 1024
  if (kb < 1024)
    return f.number(Math.round(kb), { style: 'unit', unit: 'kilobyte', unitDisplay: 'short' })
  return f.number(kb / 1024, {
    style: 'unit',
    unit: 'megabyte',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  })
}

function FileCard({ file }: { file: MailAttachment }): ReactElement {
  const f = useFormat()
  const t = useMessages(lists)
  return (
    <li
      data-slot="mail-attachment"
      className="flex h-15 w-72 max-w-full min-w-0 items-center gap-3 rounded-ctrl border border-border bg-card px-3"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-ctrl bg-muted font-mono text-micro font-medium text-muted-foreground"
      >
        {file.kind.slice(0, 4)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{file.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {file.kind} · {size(f, file.size)}
        </span>
      </span>
      {file.href !== undefined && (
        <a
          href={file.href}
          download={file.name}
          aria-label={t('lists.mailDownload', file.name)}
          className={buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' })}
        >
          <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
            <path
              d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
    </li>
  )
}

/**
 * A conversation in a reader: one bordered column of messages, oldest first. A message that is not
 * open is one row of face, sender, a line of its text and its day; opening one closes the one that
 * was open, and the latest is open at first. The open message shows the sender's address, who it
 * went to, the full time, the body with its line breaks and the attachments as file cards with a
 * download. `reply` sits at the foot, under the last message: the reply buttons, or an inline
 * composer once the reader replies.
 *
 * @useWhen a reader shows one mail conversation, or any thread of long messages where one is read at a time
 * @neverWhen short chat messages that are all read at once (use the chat parts' Message), or a feed of events (use EventList)
 *
 * @example
 * <MailThread label={thread.subject} messages={thread.messages} reply={<ReplyBar />} />
 */
export function MailThread({ label, messages, defaultOpen, reply }: MailThreadProps): ReactElement {
  const f = useFormat()
  const latest = messages.at(-1)?.id
  const [open, setOpen] = useState<string[]>(() => {
    const first = defaultOpen ?? latest
    return first === undefined ? [] : [first]
  })
  return (
    <section
      aria-label={label}
      data-slot="mail-thread"
      className="flex min-w-0 flex-col overflow-clip rounded-card border border-border bg-card"
    >
      <Accordion
        value={open}
        onValueChange={(next) => setOpen(next.map(String))}
        className="min-w-0"
      >
        {messages.map((m) => {
          const isOpen = open.includes(m.id)
          return (
            <AccordionItem key={m.id} value={m.id} data-slot="mail-message">
              <AccordionTrigger
                className={cn('min-h-12 w-full min-w-0 gap-3 rounded-none px-4', isOpen && 'py-3')}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar {...faceOf(m.from)} size={isOpen ? 'md' : 'sm'} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {m.from.name}
                      </span>
                      {isOpen && m.from.address !== undefined && (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {m.from.address}
                        </span>
                      )}
                    </span>
                    {isOpen ? (
                      m.to !== undefined && (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {m.to}
                        </span>
                      )
                    ) : (
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {m.preview ?? m.body.split('\n').find((line) => line.trim() !== '') ?? ''}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                    {isOpen ? `${f.date(m.at, 'day')}, ${f.time(m.at)}` : f.date(m.at, 'day')}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 ps-12 pe-2 pt-1 pb-3">
                  <p className="m-0 text-sm/6 whitespace-pre-line text-foreground">{m.body}</p>
                  {m.attachments !== undefined && m.attachments.length > 0 && (
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {m.attachments.map((file) => (
                        <FileCard key={file.name} file={file} />
                      ))}
                    </ul>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
      {reply !== undefined && (
        <div data-slot="mail-thread-reply" className="border-t border-border p-3">
          {reply}
        </div>
      )}
    </section>
  )
}
