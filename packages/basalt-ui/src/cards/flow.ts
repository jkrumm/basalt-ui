/**
 * The model of a flow: what `FlowCanvas` draws (columns of groups of rows, the edges between them,
 * the issues on them) and the handle the canvas and its panel share. The handle holds the tool, the
 * fold of every group (persisted per flow) and a pending reveal, so a checklist in a `PageAside` can
 * unfold a group and focus a row it does not render.
 */
import { useState } from 'react'
import { persisted } from '../core/persisted'
import type { IconComponent, Tone, Verdict } from '../core/ports'
import type { CardChip, CardMenu } from './contract'

/** A row of a group: 44 px, focusable, an anchor an edge can start or end at by its `id`. */
export type FlowRow = {
  /** Unique across the flow: the row's anchor. */
  id: string
  title: string
  /** A muted second line. */
  sub?: string | undefined
  icon?: IconComponent | undefined
  /** A dot and a word at the row's end. */
  status?: Verdict | undefined
}

/** A card of rows with a header that folds it. Its `id` is an anchor too: the header. */
export type FlowGroup = {
  id: string
  title: string
  icon?: IconComponent | undefined
  /** One neutral chip beside the title: a count, a mode. */
  chip?: CardChip | undefined
  menu?: CardMenu | undefined
  /** Whether a right click, a long press or Shift+F10 on the card opens its menu at the pointer. Default true; the browser's menu stays with false. */
  contextMenu?: boolean | undefined
  rows: readonly FlowRow[]
}

/** One column of the stage, groups top to bottom in reading order. */
export type FlowColumn = { id: string; groups: readonly FlowGroup[] }

/** A connector between two anchors (a group or a row id): decoration, never a target. */
export type FlowEdge = { from: string; to: string }

/**
 * One problem, keyed to where it is. A group header counts its own and its rows' issues, a row
 * shows a mark, an edge takes the tone when it or its target has one, and `FlowChecklist` lists it.
 */
export type FlowIssue = {
  id: string
  /** What is wrong, as a short sentence: the checklist item and the row's mark. */
  label: string
  /** Where it is or what fixes it, one muted line in the checklist. */
  hint?: string | undefined
  /** Default `warn`. */
  tone?: Extract<Tone, 'warn' | 'bad' | 'info'> | undefined
  on: { group: string } | { row: string } | { edge: FlowEdge }
}

export type FlowTool = 'pointer' | 'hand'

/** The shared state of one flow; make it with `useFlow` and pass it to the canvas and the checklist. */
export type FlowHandle = {
  readonly id: string
  readonly tool: FlowTool
  setTool: (tool: FlowTool) => void
  isFolded: (group: string) => boolean
  setFolded: (group: string, folded: boolean) => void
  /** Unfolds the group holding `anchor`, brings it into the frame and focuses it. */
  reveal: (anchor: string) => void
  /** The anchor a reveal is waiting to focus; the canvas clears it. */
  readonly pending: string | undefined
  settle: () => void
  /** Which group holds a row: the canvas fills it so a reveal can unfold the right one. */
  readonly groupOf: Map<string, string>
}

const foldsOf = (id: string) =>
  persisted<Record<string, boolean>>(`flow:${id}:folds`, { version: 1, initial: {} })

/**
 * The handle of the flow `id`: the pointer tool, the folds the reader left, and the reveal a
 * checklist calls. `id` names the persisted folds, so it is stable per flow (a workflow's id). The
 * handle's type is not exported; pass it as it comes.
 *
 * @useWhen a page draws a `FlowCanvas`, alone or with a `FlowChecklist` in its `PageAside`
 * @neverWhen the page draws a `ChainView`, which keeps its own viewport
 *
 * @example
 * const flow = useFlow({ id: `workflow:${workflow.id}` })
 * <FlowCanvas flow={flow} label="Reorder" columns={columns} edges={edges} issues={issues} />
 * <PageAside title="Workflow"><FlowChecklist flow={flow} issues={issues} /></PageAside>
 */
export function useFlow({ id }: { id: string }): FlowHandle {
  const [tool, setTool] = useState<FlowTool>('pointer')
  const [folds, setFolds] = foldsOf(id).use()
  const [pending, setPending] = useState<string | undefined>(undefined)
  const [groupOf] = useState(() => new Map<string, string>())
  const setFolded = (group: string, folded: boolean): void =>
    setFolds((prev) => {
      const next = { ...prev }
      if (folded) next[group] = true
      else delete next[group]
      return next
    })
  return {
    id,
    tool,
    setTool,
    isFolded: (group) => folds[group] === true,
    setFolded,
    reveal: (anchor) => {
      const group = groupOf.get(anchor) ?? anchor
      if (folds[group] === true) setFolded(group, false)
      setPending(anchor)
    },
    pending,
    settle: () => setPending(undefined),
    groupOf,
  }
}

/** The anchor an issue points at: its row, its group, or its edge's target. */
export const anchorOf = (issue: FlowIssue): string =>
  'row' in issue.on ? issue.on.row : 'group' in issue.on ? issue.on.group : issue.on.edge.to

const RANK: Record<NonNullable<FlowIssue['tone']>, number> = { info: 0, warn: 1, bad: 2 }

/** The worst tone among `issues`, or undefined when there are none. */
export function worstTone(issues: readonly FlowIssue[]): FlowIssue['tone'] {
  let worst: FlowIssue['tone']
  for (const issue of issues) {
    const tone = issue.tone ?? 'warn'
    if (worst === undefined || RANK[tone] > RANK[worst]) worst = tone
  }
  return worst
}
