import { DataPanel } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

const TASKS = [
  { id: 'T-102', title: 'Network policy baseline', team: 'Platform', days: 3 },
  { id: 'T-103', title: 'Schema export tooling', team: 'Data', days: 4 },
  { id: 'T-104', title: 'Secrets store cutover', team: 'Platform', days: 2 },
  { id: 'T-111', title: 'Access review for the cluster', team: 'Security', days: 2 },
]

export function Demo(): ReactElement {
  return (
    <div className="max-w-xl">
      <DataPanel
        title="Open tasks"
        subtitle="by days left"
        bodySize={{ rows: 5 }}
        body={() => (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {TASKS.map((task) => (
              <li key={task.id} className="flex justify-between gap-4">
                <span>
                  <span className="font-mono text-muted-foreground">{task.id}</span> {task.title}
                </span>
                <span className="text-muted-foreground">
                  {task.team}, {task.days} d
                </span>
              </li>
            ))}
          </ul>
        )}
      />
    </div>
  )
}
