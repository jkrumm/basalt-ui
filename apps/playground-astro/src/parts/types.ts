/**
 * Every part the Astro playground renders, one entry per demo module (src/parts/<module>.tsx, which exports
 * `Demo`). Pure data: scripts/gen-pages.ts reads it to write the pages and scripts/matrix.ts to judge them.
 *
 * `covers` names the exported components the demo renders (the export-surface shards are the list of
 * exports; an export no entry covers is listed as such in the matrix). `interaction` says what the part
 * needs JavaScript for, which decides its best mode once the measurements say whether its static HTML is right:
 * - `none`: the static picture is the whole part (a badge, a card, prose).
 * - `enhance`: the static picture is useful and JavaScript adds behaviour on top (sorting, hover, a toggle).
 * - `required`: nothing useful happens without JavaScript (a dialog, a menu, a combobox).
 */
export const MODES = ['static', 'visible', 'idle', 'load', 'only'] as const
export type Mode = (typeof MODES)[number]

export const FAMILIES = ['ui', 'cards', 'charts', 'table', 'content', 'page', 'forms'] as const
export type Family = (typeof FAMILIES)[number]

export type Interaction = 'none' | 'enhance' | 'required'

export type PartEntry = {
  id: string
  family: Family
  module: string
  covers: readonly string[]
  interaction: Interaction
  /** What the JavaScript is for, or why the part needs none. */
  why: string
  /** A chart kind: the matrix answers the static-picture question for it. */
  chart?: true
}
