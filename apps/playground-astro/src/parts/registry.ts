/**
 * Every part the Astro playground renders: the family lists (src/parts/<family>/index.ts) in one array.
 * Pure data: scripts/gen-pages.ts writes the pages from it and scripts/matrix.ts judges them by it.
 */
import { PARTS as cards } from './cards'
import { PARTS as charts } from './charts'
import { PARTS as content } from './content'
import { PARTS as forms } from './forms'
import { PARTS as page } from './page'
import { PARTS as table } from './table'
import { PARTS as ui } from './ui'
import type { PartEntry } from './types'

export { FAMILIES, MODES } from './types'
export type { Family, Interaction, Mode, PartEntry } from './types'

export const PARTS: readonly PartEntry[] = [
  ...ui,
  ...cards,
  ...charts,
  ...table,
  ...content,
  ...page,
  ...forms,
]
