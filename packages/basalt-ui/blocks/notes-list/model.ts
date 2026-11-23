/** The notes list's domain: the note as the list reads it, and the type labels. */
export const NOTE_TYPES = ['call', 'meeting', 'quality', 'email', 'memo'] as const
export type NoteType = (typeof NOTE_TYPES)[number]
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  call: 'Call',
  meeting: 'Meeting',
  quality: 'Quality issue',
  email: 'Email',
  memo: 'Memo',
}

export type Note = {
  id: string
  title: string
  type: NoteType
  body: string
  supplierId: string
  supplier: string
  part: string
  author: string
  /** The time the note was last updated, as an ISO string. */
  updated: string
}
