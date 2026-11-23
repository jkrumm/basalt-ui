/**
 * What the side panels remember on the device, one `persisted` key per panel kind: the width the
 * reader dragged a panel to, a record kind's presentation (`peek`, `window` or `page`) and its
 * window's size. Internal: `Peek`, `Dock` and `PageAside` read them.
 */
import { persisted } from '../../core/persisted'
import type { Persisted, PersistedSchema } from '../../core/persisted'

/** How a record opens: a side panel, a floating window or the whole main area. */
export type Presentation = 'peek' | 'window' | 'page'

export const PRESENTATIONS: readonly Presentation[] = ['peek', 'window', 'page']

/** A window's size in px. */
export type WindowSize = { w: number; h: number }

function schema<T>(accept: (value: unknown) => value is T): PersistedSchema<T> {
  return {
    '~standard': {
      validate: (value) => (accept(value) ? { value } : { issues: [{ message: 'rejected' }] }),
    },
  }
}

const isWidth = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0)

const isPresentation = (value: unknown): value is Presentation =>
  typeof value === 'string' && (PRESENTATIONS as readonly string[]).includes(value)

const isSize = (value: unknown): value is WindowSize | null =>
  value === null ||
  (typeof value === 'object' &&
    isWidth((value as WindowSize).w) &&
    isWidth((value as WindowSize).h) &&
    (value as WindowSize).w !== null)

/**
 * The width a panel kind was dragged to: `peek:<record kind>`, `dock`, `aside:<declared width>` (an
 * inspector declared at 360 and an editor at 640 are two kinds). `null` is its default.
 */
export function widthStore(kind: string): Persisted<number | null> {
  return persisted(`panel:${kind}:width`, { version: 1, initial: null, schema: schema(isWidth) })
}

/** The presentation a record kind opens in; `initial` (`peek`) until the reader picks another. */
export function presentationStore(
  kind: string,
  initial: Presentation = 'peek',
): Persisted<Presentation> {
  return persisted(`panel:${kind}:present`, {
    version: 1,
    initial,
    schema: schema(isPresentation),
  })
}

/** A record kind's window size; `null` until the reader resizes it. */
export function windowStore(kind: string): Persisted<WindowSize | null> {
  return persisted(`panel:${kind}:window`, { version: 1, initial: null, schema: schema(isSize) })
}
