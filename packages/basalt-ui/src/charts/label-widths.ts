/**
 * Text width from the checked-in advance table (`chart-labels-widths.gen.ts`): no canvas and no DOM,
 * so a server render measures what the browser does. Its own module so the engine host
 * (`text-measure.ts`) carries the table and nothing of `chartLabels`.
 */
import { GLYPHS, WIDTHS } from './chart-labels-widths.gen'

export type TableWeight = keyof typeof WIDTHS

const INDEX = new Map<string, number>([...GLYPHS].map((ch, i) => [ch, i]))

/** The advance width in px of `text` at `size` px; a glyph the table lacks counts as its mean. */
export function measure(text: string, size: number, weight: TableWeight): number {
  const table = WIDTHS[weight]
  let em = 0
  for (const ch of text) {
    const i = INDEX.get(ch)
    em += i === undefined ? table.mean : (table.advances[i] ?? table.mean)
  }
  return em * size
}
