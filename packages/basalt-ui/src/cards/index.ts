/** `basalt-ui/cards` — the card composites (`StatCard`, `StatGroup`, `StatCell`, `DataPanel`, `BarList`, `EventList`, `RowList`, `StepRail`, `KanbanCard`, `Board`, `ChainView`). Peers: react, `@base-ui/react` (via `ui/card`). */

export { StatCard } from './stat-card'
export { StatGroup } from './stat-group'
export { StatCell } from './stat-cell'
export { DataPanel } from './data-panel'
export { BarList } from './bar-list'
export { EventList } from './event-list'
export { RowList } from './row-list'
export { StepRail } from './step-rail'
export { KanbanCard } from './kanban-card'
export { Board, applyMove } from './board'
export { ChainView } from './chain-view'
export type {
  StatCardProps,
  DataPanelProps,
  KanbanCardProps,
  ColumnRef,
  Move,
  CardChip,
  CardMenu,
  MenuEntry,
  LegendEntry,
} from './contract'
// The frame's value types, one subpath for every frame part's doc (wiring-3.2): `Phase` and
// `QueryStateLike` type the `phase` of `StatCard`, `ChartCard`, `QueryState` and `useDataTable` alike.
export type { CardAction, Empty, Fact, FootFacts, FrameHead, FrameState, Menu } from '../core/phase'
export type { Delta, Phase, QueryStateLike, Status, Tone, Verdict } from '../core/ports'
export type { StatGroupProps } from './stat-group'
export type { StatCellProps } from './stat-cell'
export type { BarListProps } from './bar-list'
export type { EventListProps } from './event-list'
export type { RowListProps } from './row-list'
export type { StepRailProps, StepRailRow } from './step-rail'
export type { ChainViewProps, ChainFace } from './chain-view'
export type { BoardProps } from './board'
