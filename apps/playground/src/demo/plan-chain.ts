/**
 * One dependency dataset for the chain demo (`/kit/chain`): the tasks of a data-platform
 * migration and the tasks each waits on. Authored, no clock, no random, so a shot is the same shot.
 * It holds a fan-out (T-101 opens four tasks), fan-ins (T-110 and T-114 wait on two or three) and
 * blocked tasks (waiting on a task that is not done).
 */

export type TaskState = 'done' | 'running' | 'queued' | 'waiting'

export type Task = {
  id: string
  title: string
  team: string
  state: TaskState
  /** Days of work left. */
  days: number
  /** Ids of the tasks this one waits on; the first is the one it is listed under when nested. */
  waitsOn: readonly string[]
}

const task = (
  id: string,
  team: string,
  state: TaskState,
  days: number,
  title: string,
  waitsOn: readonly string[] = [],
): Task => ({ id, title, team, state, days, waitsOn })

export const TASKS: readonly Task[] = [
  task('T-101', 'Platform', 'done', 0, 'Provision the new cluster'),
  task('T-102', 'Platform', 'running', 3, 'Network policy baseline', ['T-101']),
  task('T-103', 'Data', 'running', 4, 'Schema export tooling', ['T-101']),
  task('T-104', 'Platform', 'queued', 2, 'Secrets store cutover', ['T-101']),
  task('T-105', 'Data', 'done', 0, 'Snapshot the legacy warehouse', ['T-101']),
  task('T-106', 'Data', 'waiting', 5, 'Backfill the event tables', ['T-103', 'T-105']),
  task('T-107', 'Apps', 'waiting', 2, 'Point the billing service at the cluster', [
    'T-102',
    'T-104',
  ]),
  task('T-108', 'Apps', 'waiting', 3, 'Point the search service at the cluster', ['T-102']),
  task('T-109', 'Data', 'waiting', 2, 'Validate row counts', ['T-106']),
  task('T-110', 'Apps', 'waiting', 1, 'Dual-write window', ['T-107', 'T-108', 'T-109']),
  task('T-111', 'Security', 'queued', 2, 'Access review for the cluster'),
  task('T-112', 'Security', 'waiting', 1, 'Rotate service credentials', ['T-111', 'T-104']),
  task('T-113', 'Platform', 'waiting', 1, 'Decommission the legacy hosts', ['T-110']),
  task('T-114', 'Apps', 'waiting', 1, 'Announce the cutover', ['T-110', 'T-112']),
]
