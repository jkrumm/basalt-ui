import { ChainView } from 'basalt-ui/cards'
import type { ReactElement } from 'react'
import { TASKS } from '../../../../playground/src/demo/plan-chain'

/** The first eight tasks of the migration plan: every blocker of a listed task is listed too. */
const NODES = TASKS.slice(0, 8)

export function Demo(): ReactElement {
  return (
    <ChainView
      label="Migration plan"
      nodes={NODES}
      getId={(task) => task.id}
      waitsOn={(task) => task.waitsOn}
      face={(task) => ({ title: task.title, sub: task.id, done: task.state === 'done' })}
    />
  )
}
