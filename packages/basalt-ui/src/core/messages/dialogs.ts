import type { BasaltMessages } from './index'

/**
 * The overlay primitives' strings: the accessible names Base UI would otherwise hardcode in English
 * (the toast region and the close controls). Keys keep their component prefix (`dialog.`, `sheet.`,
 * `toast.`); `messages.coverage.test.ts` maps those prefixes to this area.
 *
 * - `toast.viewport`: the name of the toast region;
 * - `toast.dismiss`: the name of a toast's close button;
 * - `dialog.close`, `sheet.close`: the name of the corner close button.
 */
export type DialogsMessages = Record<
  'toast.viewport' | 'toast.dismiss' | 'dialog.close' | 'sheet.close',
  string
>

export const dialogs = {
  'toast.viewport': 'Notifications',
  'toast.dismiss': 'Dismiss',
  'dialog.close': 'Close',
  'sheet.close': 'Close',
} satisfies Partial<BasaltMessages>
