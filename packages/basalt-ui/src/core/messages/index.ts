/**
 * The message index: one interface per area, intersected here into `BasaltMessages`, and the merged
 * English catalog `en`.
 *
 * Each area owns its file (`./table.ts`: its `TableMessages` interface and its defaults) and adds
 * exactly one import line and one spread here. A key is area-prefixed (`table.rowRange`) and
 * referenced from exactly one place; `messages.coverage.test.ts` holds both. An app overrides keys
 * with the provider's `messages` prop (`Partial<BasaltMessages>`).
 *
 * Nothing imports this file at runtime except `use-messages` and tests: the provider chunk only
 * sees the erased type.
 */
import { ai } from './ai'
import type { AiMessages } from './ai'
import { base } from './base'
import type { BaseMessages } from './base'
import { cards } from './cards'
import type { CardsMessages } from './cards'
import { charts } from './charts'
import type { ChartsMessages } from './charts'
import { controls } from './controls'
import type { ControlsMessages } from './controls'
import { date } from './date'
import type { DateMessages } from './date'
import { dialogs } from './dialogs'
import type { DialogsMessages } from './dialogs'
import { filters } from './filters'
import type { FiltersMessages } from './filters'
import { home } from './home'
import type { HomeMessages } from './home'
import { kanban } from './kanban'
import type { KanbanMessages } from './kanban'
import { lists } from './lists'
import type { ListsMessages } from './lists'
import { live } from './live'
import type { LiveMessages } from './live'
import { page } from './page'
import type { PageMessages } from './page'
import { select } from './select'
import type { SelectMessages } from './select'
import { table } from './table'
import type { TableMessages } from './table'

export type BasaltMessages = SelectMessages &
  DialogsMessages &
  BaseMessages &
  DateMessages &
  CardsMessages &
  ListsMessages &
  KanbanMessages &
  ControlsMessages &
  HomeMessages &
  FiltersMessages &
  TableMessages &
  LiveMessages &
  ChartsMessages &
  AiMessages &
  PageMessages

/** The English defaults of every area, merged. Typed as the full interface: a missing key is a type error. */
export const en: BasaltMessages = {
  ...select,
  ...dialogs,
  ...base,
  ...date,
  ...cards,
  ...lists,
  ...kanban,
  ...controls,
  ...home,
  ...filters,
  ...table,
  ...live,
  ...charts,
  ...ai,
  ...page,
}
