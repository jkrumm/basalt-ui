import { persisted, useFormat } from 'basalt-ui'
import { Composer } from 'basalt-ui/ai'
import { MailList, MailThread } from 'basalt-ui/cards'
import type { MailItem, MailMessage, QueryStateLike } from 'basalt-ui/cards'
import { FormRow, useFormDraft } from 'basalt-ui/controls'
import type { NavTarget } from 'basalt-ui/core/ports'
import { useAppForm } from 'basalt-ui/form'
import { EmptyState, Page, PageBar, Peek, SplitPage, useSizeClass } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import { Skeleton } from 'basalt-ui/ui/skeleton'
import { defineControls, field } from 'basalt-ui/router'
import { BulkBar } from 'basalt-ui/table'
import { Button } from 'basalt-ui/ui/button'
import { EntityChip, EntityTitle } from 'basalt-ui/ui/entity'
import { Input } from 'basalt-ui/ui/input'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import {
  Archive,
  Factory,
  FileText,
  Forward,
  Mail,
  MailOpen,
  Maximize2,
  Reply,
  Rows3,
  SquarePen,
  Star,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { z } from 'zod'
import { MAIL_FOLDERS, MAIL_FOLDER_LABELS } from './model'
import type { Conversation, Draft, MailFolder, Message, Outgoing, Person } from './model'

/** The reader's loaded shape while the mailbox loads: the subject, the chips, three message rows. */
function ReaderSkeleton(): ReactElement {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <div className="text-lg">
          <Skeleton className="w-96 max-w-full" />
        </div>
        <div className="text-xs">
          <Skeleton className="w-48" />
        </div>
      </div>
      <div className="flex gap-2 text-sm">
        <Skeleton className="w-40" />
        <Skeleton className="w-28" />
      </div>
      <Card>
        <div className="flex flex-col gap-4 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="text-sm">
                <Skeleton className="w-40" />
              </div>
              <div className="text-xs">
                <Skeleton className="w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/** The folder, the search, the open conversation and the open composer live in the address. The route wires it. */
export const mailControls = defineControls({
  id: 'ref-mail',
  scope: 'page',
  fields: {
    folder: field.enum(MAIL_FOLDERS, 'inbox').labels(MAIL_FOLDER_LABELS),
    search: field.string(''),
    mail: field.string('', { history: 'push' }),
    compose: field.enum(['none', 'new', 'reply', 'forward'], 'none'),
  },
})

type ComposeKind = 'new' | 'reply' | 'forward'

/**
 * Where a reply opens: under the thread, or on the record surface, where `Peek` remembers the
 * panel, the window or the page for the `compose` kind. A new mail always opens on the surface.
 */
const composerHome = persisted<'inline' | 'surface'>('ref-mail:composer', {
  version: 1,
  initial: 'inline',
  schema: z.enum(['inline', 'surface']),
})

const Values = z.object({
  to: z.string().trim().min(1, 'Name at least one recipient.'),
  cc: z.string(),
  subject: z.string().trim().min(1, 'Give the mail a subject.'),
  body: z.string(),
})

/** A draft is any half-written mail: the checks of `Values` apply at send, never to what is kept. */
const DraftSchema = z.object({
  to: z.string(),
  cc: z.string(),
  subject: z.string(),
  body: z.string(),
})

type Patch = Partial<Pick<Conversation, 'unread' | 'starred' | 'folder'>> & { deleted?: boolean }

const latest = (c: Conversation): number => Date.parse(c.messages.at(-1)?.at ?? '')

/** The other party of a thread: the supplier contact, else whoever wrote last. */
const contactOf = (c: Conversation): Person | undefined =>
  c.messages.find((m) => m.from.org !== undefined)?.from ?? c.messages.at(-1)?.from

/** The first line of a body that says something: past the greeting. */
const snippetOf = (body: string): string =>
  body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.endsWith(',')) ?? ''

/** A message as the thread draws it; the files link nowhere in the reference. */
const threadMessage = (m: Message): MailMessage => ({
  id: m.id,
  from: { name: m.from.name, address: m.from.address },
  to: m.to,
  at: Date.parse(m.at),
  body: m.body,
  preview: snippetOf(m.body),
  attachments: m.attachments.map((a) => ({ ...a, href: '#' })),
})

const quote = (m: Message | undefined): string =>
  m === undefined ? '' : `\n\n${m.from.name} wrote:\n${m.body.replace(/^/gm, '> ')}`

export type MailboxProps = {
  /** The conversations query state: its rows and its phase. */
  conversations: QueryStateLike & { data?: readonly Conversation[] | undefined }
  /** The reading time in ms, for the day groups and the times. */
  now: number
  /** The link to a supplier's record. */
  supplierHref: (supplierId: string) => NavTarget
  /** Hands a written mail to the transport. */
  onSend: (mail: Outgoing) => unknown
}

/** To, Cc and Subject over the shared composer; the draft is kept on the device until it is sent or discarded. */
function ComposeForm({
  draftKey,
  start,
  onSend,
  onDone,
  lead,
  aside,
}: {
  draftKey: string
  start: Draft
  onSend: (mail: Outgoing) => unknown
  onDone: () => void
  lead?: ReactNode
  /** What sits under the form on the record surface: the message replied to, or contacts that fill To. */
  aside?: ((fillTo: (address: string) => void) => ReactNode) | undefined
}): ReactElement {
  // The first values only: a fresh object each render would read to the form as new defaults and wipe a restored draft.
  const [initial] = useState(start)
  // The files ride beside the form: a File is no form value, and a draft cannot keep one.
  const files = useRef<readonly File[]>([])
  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      await onSend({ ...value, attachments: files.current })
      onDone()
    },
  })
  const draft = useFormDraft(form, { key: draftKey, version: 1, owner: null, schema: DraftSchema })
  return (
    <div data-shot="composer" className="flex flex-col gap-3">
      {lead}
      <form.AppForm>
        <form.Form>
          <FormRow>
            <form.AppField name="to" validators={{ onBlur: Values.shape.to }}>
              {(f) => (
                <f.FormField label="To" required>
                  <Input type="email" multiple autoComplete="email" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="cc">
              {(f) => (
                <f.FormField label="Cc">
                  <Input type="email" multiple autoComplete="email" />
                </f.FormField>
              )}
            </form.AppField>
          </FormRow>
          <form.AppField name="subject" validators={{ onBlur: Values.shape.subject }}>
            {(f) => (
              <f.FormField label="Subject" required>
                <Input autoComplete="off" />
              </f.FormField>
            )}
          </form.AppField>
        </form.Form>
      </form.AppForm>
      {/* The composer keeps its own text; its input event carries the text into the form, so the draft holds it. */}
      <div
        onInput={(event) => {
          if (event.target instanceof HTMLTextAreaElement)
            form.setFieldValue('body', event.target.value)
        }}
      >
        <Composer
          key={draft.status}
          aria-label="Message"
          placeholder="Write the mail. Shift and Enter start a new line."
          defaultValue={form.state.values.body}
          files={{ accept: '.pdf,.xlsx,.csv,image/*', maxSize: 20_000_000, maxFiles: 5 }}
          onSend={async ({ text, files: attached }) => {
            files.current = attached
            form.setFieldValue('body', text)
            await form.handleSubmit()
            if (!form.state.isSubmitSuccessful) throw new Error('The mail is not complete.')
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {draft.status === 'restored' ? 'Draft restored' : 'The draft is kept on this device.'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            draft.clear()
            onDone()
          }}
        >
          Discard
        </Button>
      </div>
      {aside?.((address) => form.setFieldValue('to', address))}
    </div>
  )
}

/** One conversation in the reader: its subject and actions, the supplier and the order, the thread and the reply. */
function Reader({
  conversation: c,
  supplierHref,
  onPatch,
  reply,
}: {
  conversation: Conversation
  supplierHref: (supplierId: string) => NavTarget
  onPatch: (patch: Patch) => void
  reply: ReactNode
}): ReactElement {
  const people = [...new Set(c.messages.map((m) => m.from.name))].join(', ')
  const count = c.messages.length
  return (
    <div className="grid min-h-0 flex-1 grid-rows-1">
      <ScrollArea aria-label={c.subject}>
        <div data-shot="reader" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-5">
          <EntityTitle
            size="lg"
            level={2}
            title={c.subject}
            subtitle={`${people} · ${count} ${count === 1 ? 'message' : 'messages'}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 basis-64 flex-wrap gap-2">
              <EntityChip
                label={c.supplier}
                href={supplierHref(c.supplierId)}
                avatar={{ shape: 'object', icon: Factory }}
              />
              {c.order !== undefined && (
                <EntityChip label={c.order} avatar={{ shape: 'object', icon: FileText }} />
              )}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label="Archive"
                onClick={() => onPatch({ folder: 'archive' })}
              >
                <Archive aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label="Mark as unread"
                onClick={() => onPatch({ unread: true })}
              >
                <Mail aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label={c.starred ? 'Remove star' : 'Star'}
                aria-pressed={c.starred}
                onClick={() => onPatch({ starred: !c.starred })}
              >
                <Star aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label="Delete"
                onClick={() => onPatch({ deleted: true })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
          <MailThread
            key={c.id}
            label={c.subject}
            messages={c.messages.map(threadMessage)}
            reply={reply}
          />
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * The reference mailbox: supplier correspondence about purchase orders. Folders as counted tabs, a
 * list of mail under day groups beside a reader the reader can widen, a thread whose latest message
 * is open, and a composer that opens under the thread, as a side panel, a window or the page.
 */
export function Mailbox({
  conversations: query,
  now,
  supplierHref,
  onSend,
}: MailboxProps): ReactElement {
  const values = mailControls.useValues()
  const { mail, compose: composeField } = mailControls.field
  const f = useFormat()
  const compact = useSizeClass() === 'compact'
  const [home, setHome] = composerHome.use()
  const [selected, setSelected] = useState<readonly string[]>([])
  const [patches, setPatches] = useState<Readonly<Record<string, Patch>>>({})
  const patch = (ids: readonly string[], next: Patch): void =>
    setPatches((before) => ({
      ...before,
      ...Object.fromEntries(ids.map((id) => [id, { ...before[id], ...next }])),
    }))

  const all = (query.data ?? [])
    .map((c) => ({ ...c, ...patches[c.id] }))
    .filter((c) => c.deleted !== true)
  const needle = values.search.trim().toLowerCase()
  const inFolder = (c: Conversation): boolean =>
    values.folder === 'starred' ? c.starred && c.folder !== 'archive' : c.folder === values.folder
  const shown = all
    .filter(inFolder)
    .filter(
      (c) =>
        needle === '' ||
        c.subject.toLowerCase().includes(needle) ||
        c.supplier.toLowerCase().includes(needle) ||
        (c.order ?? '').toLowerCase().includes(needle) ||
        c.messages.some((m) => m.from.name.toLowerCase().includes(needle)),
    )
    .toSorted((a, b) => latest(b) - latest(a))
  const open = all.find((c) => c.id === values.mail)
  const contacts = [
    ...new Map(
      all
        .flatMap((c) => c.messages.map((m) => m.from))
        .filter((p) => p.org !== undefined)
        .map((p) => [p.address, p]),
    ).values(),
  ]
  const count = (folder: MailFolder): number =>
    all.filter((c) => c.folder === folder && c.unread).length

  const items: MailItem[] = shown.map((c) => {
    const last = c.messages.at(-1)
    const contact = contactOf(c)
    return {
      id: c.id,
      from: {
        name: contact?.name ?? c.supplier,
        org: { name: c.supplier, icon: Factory },
      },
      subject: c.subject,
      snippet: snippetOf(last?.body ?? ''),
      at: latest(c),
      unread: c.unread,
      starred: c.starred,
      count: c.messages.length,
      attachments: c.messages.some((m) => m.attachments.length > 0),
      ...(c.order !== undefined && {
        entity: {
          label: c.order,
          href: supplierHref(c.supplierId),
          avatar: { shape: 'object' as const, icon: FileText },
        },
      }),
    }
  })

  // A reply or a forward needs the conversation it answers: with none open (a stale link) nothing opens.
  const kind: ComposeKind | null =
    values.compose === 'none' ||
    query.data === undefined ||
    (values.compose !== 'new' && open === undefined)
      ? null
      : values.compose
  const other = open === undefined ? undefined : contactOf(open)
  const bare = open?.subject.replace(/^(Re|Fwd): /, '') ?? ''
  const start: Draft =
    kind === 'reply'
      ? { to: other?.address ?? '', cc: '', subject: `Re: ${bare}`, body: '' }
      : kind === 'forward'
        ? { to: '', cc: '', subject: `Fwd: ${bare}`, body: quote(open?.messages.at(-1)) }
        : { to: '', cc: '', subject: '', body: '' }
  const draftKey = `ref-mail:${kind ?? 'none'}:${kind === 'new' ? 'new' : (open?.id ?? '')}`
  const inline = kind !== null && kind !== 'new' && home === 'inline' && !compact
  const close = (): void => composeField.clear()

  const reply = inline ? (
    <ComposeForm
      key={draftKey}
      draftKey={draftKey}
      start={start}
      onSend={onSend}
      onDone={close}
      lead={
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {kind === 'reply' ? `Reply to ${other?.name ?? ''}` : 'Forward'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setHome('surface')}>
            <Maximize2 aria-hidden="true" />
            Pop out
          </Button>
        </div>
      }
    />
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => composeField.choose('reply')}>
        <Reply aria-hidden="true" />
        Reply
      </Button>
      <Button variant="secondary" size="sm" onClick={() => composeField.choose('forward')}>
        <Forward aria-hidden="true" />
        Forward
      </Button>
    </div>
  )

  return (
    <Page area="ref-mail" fill>
      <PageBar
        tabs={{
          state: mailControls.field.folder,
          label: 'Mail folders',
          badges:
            query.data === undefined
              ? {}
              : {
                  inbox: { count: count('inbox') },
                  starred: { count: all.filter((c) => c.starred && c.folder !== 'archive').length },
                },
        }}
        search={{
          state: mailControls.field.search,
          label: 'Search mail',
          placeholder: 'Sender, subject or order',
        }}
        actions={[
          {
            id: 'new',
            label: 'New email',
            icon: SquarePen,
            primary: true,
            onClick: () => composeField.choose('new'),
          },
        ]}
      />
      <div data-shot="mailbox" className="flex min-h-0 flex-1 flex-col">
        <SplitPage
          selected={mail.useIsSet() && open !== undefined}
          onBack={mail.clear}
          backLabel={MAIL_FOLDER_LABELS[values.folder]}
          scroll="panes"
          resize={{ id: 'ref-mail', initial: 440, min: 320, max: 640 }}
          list={() => (
            <MailList
              label={MAIL_FOLDER_LABELS[values.folder]}
              items={items}
              now={now}
              phase={query}
              {...(items.length === 0 &&
                (needle === ''
                  ? {
                      empty: {
                        cause: `Nothing in ${MAIL_FOLDER_LABELS[values.folder]}. Mail from suppliers about their orders lands here.`,
                        action: { label: 'New email', onClick: () => composeField.choose('new') },
                      },
                    }
                  : {
                      empty: {
                        cause: `No mail matches "${values.search}". Try a supplier, a contact or an order number.`,
                        filtered: { reset: () => mailControls.field.search.clear() },
                      },
                    }))}
              open={open?.id ?? null}
              onOpen={(id) => {
                patch([id], { unread: false })
                if (id !== open?.id) composeField.clear()
                mail.choose(id)
              }}
              selected={selected}
              onSelectedChange={setSelected}
              virtual={VirtualList}
              onStar={(item, starred) => patch([item.id], { starred })}
              actions={[
                {
                  id: 'archive',
                  label: 'Archive',
                  icon: Archive,
                  onClick: (item) => patch([item.id], { folder: 'archive' }),
                },
                {
                  id: 'unread',
                  label: 'Mark as unread',
                  icon: Mail,
                  onClick: (item) => patch([item.id], { unread: true }),
                },
              ]}
              bulk={
                <BulkBar
                  count={selected.length}
                  onClear={() => setSelected([])}
                  actions={[
                    {
                      id: 'archive',
                      label: 'Archive',
                      icon: Archive,
                      onClick: () => {
                        patch(selected, { folder: 'archive' })
                        setSelected([])
                      },
                    },
                    {
                      id: 'read',
                      label: 'Mark read',
                      icon: MailOpen,
                      onClick: () => patch(selected, { unread: false }),
                    },
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: Trash2,
                      tone: 'danger',
                      onClick: () => {
                        patch(selected, { deleted: true })
                        setSelected([])
                      },
                    },
                  ]}
                />
              }
            />
          )}
          detail={() =>
            query.data === undefined ? (
              query.isError ? (
                <p className="m-auto max-w-80 p-4 text-center text-sm text-muted-foreground">
                  The inbox did not load, so there is no conversation to read.
                </p>
              ) : (
                <ReaderSkeleton />
              )
            ) : items.length === 0 ? (
              <p className="m-auto p-4 text-sm text-muted-foreground">Nothing to read.</p>
            ) : open === undefined ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  tier="section"
                  icon={Mail}
                  cause={`${f.number(count('inbox'))} unread in the inbox. Pick a conversation to read it here.`}
                />
              </div>
            ) : (
              <Reader
                conversation={open}
                supplierHref={supplierHref}
                onPatch={(next) => patch([open.id], next)}
                reply={reply}
              />
            )
          }
        />
      </div>
      {kind !== null && !inline && (
        <Peek
          kind="compose"
          defaultPresent="window"
          title={kind === 'new' ? 'New email' : start.subject}
          icon={SquarePen}
          onClose={close}
          {...(kind !== 'new' &&
            !compact && {
              actions: [
                {
                  id: 'inline',
                  label: 'Reply under the thread',
                  icon: Rows3,
                  onClick: () => setHome('inline'),
                },
              ],
            })}
        >
          <ComposeForm
            key={draftKey}
            draftKey={draftKey}
            start={start}
            onSend={onSend}
            onDone={close}
            aside={(fillTo) => {
              if (kind !== 'new' && open !== undefined) {
                return (
                  <div className="flex flex-col gap-4">
                    {open.messages.toReversed().map((m) => (
                      <figure
                        key={m.id}
                        className="m-0 flex flex-col gap-2 border-s-2 border-border ps-3"
                      >
                        <figcaption className="text-xs text-muted-foreground">
                          {`${m.from.name} wrote on ${f.date(Date.parse(m.at), 'day')}`}
                        </figcaption>
                        <blockquote className="m-0 text-sm whitespace-pre-line text-muted-foreground">
                          {m.body}
                        </blockquote>
                      </figure>
                    ))}
                  </div>
                )
              }
              if (contacts.length === 0) return null
              return (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">Supplier contacts</span>
                  <div className="flex flex-wrap gap-1">
                    {contacts.map((p) => (
                      <Button
                        key={p.address}
                        variant="ghost"
                        size="sm"
                        onClick={() => fillTo(p.address)}
                      >
                        <Factory aria-hidden="true" />
                        {`${p.name}, ${p.org ?? ''}`}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            }}
          />
        </Peek>
      )}
    </Page>
  )
}
