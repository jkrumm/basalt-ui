/** The mailbox's domain: a conversation with a supplier, its messages and the folders. */
export const MAIL_FOLDERS = ['inbox', 'starred', 'sent', 'archive'] as const
export type MailFolder = Exclude<(typeof MAIL_FOLDERS)[number], 'starred'>
export const MAIL_FOLDER_LABELS: Record<(typeof MAIL_FOLDERS)[number], string> = {
  inbox: 'Inbox',
  starred: 'Starred',
  sent: 'Sent',
  archive: 'Archive',
}

/** Someone who writes: a name, an address and, for a supplier contact, the company. */
export type Person = { name: string; address: string; org?: string }

export type Attachment = { name: string; kind: string; size: number }

export type Message = {
  id: string
  from: Person
  /** Who it went to, as the reader reads it: `to me`. */
  to: string
  /** When it was sent, as an ISO string. */
  at: string
  body: string
  attachments: readonly Attachment[]
}

/** One thread with a supplier, oldest message first. */
export type Conversation = {
  id: string
  subject: string
  supplierId: string
  supplier: string
  /** The purchase order the thread is about. */
  order?: string
  folder: MailFolder
  unread: boolean
  starred: boolean
  messages: readonly Message[]
}

/** What the composer holds while it is written, and keeps as a draft. */
export type Draft = { to: string; cc: string; subject: string; body: string }

/** What the composer sends: the written mail and the files attached to it. */
export type Outgoing = Draft & { attachments: readonly File[] }
