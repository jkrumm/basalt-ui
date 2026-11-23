/**
 * The palette's rows and its rank. The ranking itself is the one every list uses
 * (`src/core/list/rank.ts`); this module keeps the palette's row type.
 */
import type { RankFn as ListRankFn } from '../../core/list/rank'
import type { CommandEntry } from './define-commands'

export { defaultRank } from '../../core/list/rank'

/** A row of the palette: a declared command, a built-in or a nav destination. */
export type PaletteItem = Pick<
  CommandEntry,
  | 'id'
  | 'label'
  | 'group'
  | 'keywords'
  | 'icon'
  | 'steps'
  | 'chord'
  | 'area'
  | 'enabled'
  | 'listed'
  | 'run'
>

/** Orders and filters the palette's items for a query. An empty query arrives as `''`. */
export type RankFn = ListRankFn<PaletteItem>
