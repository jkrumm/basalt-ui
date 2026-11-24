/** `basalt-ui/cards` — the card composites (`StatCard`, `StatGroup`, `StatCell`, `DataPanel`, `BarList`, `EventList`, `RowList`, `RelationshipCard`, `StepRail`, `KanbanCard`, `Board`, `ChainView`, `FlowCanvas`, `FlowChecklist`, `Schedule`, `MailList`, `MailThread`). Peers: react, `@base-ui/react` (via `ui/card`). */

export { StatCard } from './stat-card'
export { StatGroup } from './stat-group'
export { StatCell } from './stat-cell'
export { DataPanel } from './data-panel'
export { BarList } from './bar-list'
export { EventList } from './event-list'
export { periodOf } from './event-list-model'
export { RowList } from './row-list'
export { RelationshipCard } from './relationship-card'
export { StepRail } from './step-rail'
export { KanbanCard } from './kanban-card'
export { Board, applyMove } from './board'
export { ChainView } from './chain-view'
export { FlowCanvas } from './flow-canvas'
export { FlowChecklist } from './flow-checklist'
export { useFlow } from './flow'
export { Schedule } from './schedule'
export { MailList } from './mail-list'
export { MailThread } from './mail-thread'
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
  CardTarget,
  StatRow,
} from './contract'
// The frame's value types, one subpath for every frame part's doc (wiring-3.2): `Phase` and
// `QueryStateLike` type the `phase` of `StatCard`, `ChartCard`, `QueryState` and `useDataTable` alike.
export type { CardAction, Empty, Fact, FootFacts, FrameHead, FrameState } from '../core/phase'
export type { Delta, Phase, QueryStateLike, Tone, Verdict } from '../core/ports'
export type { StatGroupProps } from './stat-group'
export type { StatCellProps } from './stat-cell'
export type { BarListProps } from './bar-list'
export type { EventListProps } from './event-list'
export type { RowListProps } from './row-list'
export type { RelationshipCardProps } from './relationship-card'
export type { StepRailProps, StepRailRow } from './step-rail'
export type { ChainViewProps, ChainFace } from './chain-view'
export type { FlowCanvasProps } from './flow-canvas'
// The column, group, row, edge and issue shapes stay inline: `FlowCanvasProps['columns'][number]`.
export type { FlowChecklistProps } from './flow-checklist'
export type { BoardProps } from './board'
export type { MiniMonthLike, ScheduleEvent, ScheduleProps } from './schedule'
export type { MailItem, MailListProps } from './mail-list'
export type { MailMessage, MailThreadProps } from './mail-thread'
