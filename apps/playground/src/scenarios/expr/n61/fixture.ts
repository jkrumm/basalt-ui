/**
 * Open Issues of one project (scenario expr-n61): about thirty, each with the hours since its last
 * state change. The default fixture holds two Issues for over a week and nothing running; `calm`
 * holds none that long; `ancient` holds one for over a year, the extreme the meter must survive.
 */

export const STATES = ['running', 'checking', 'ready', 'paused', 'held'] as const
export type State = (typeof STATES)[number]
export type Kind = 'feat' | 'fix' | 'chore'

export type Issue = {
  id: string
  title: string
  kind: Kind
  origin: string
  state: State
  /** Hours since the last state change. */
  waitHours: number
  attempts: number
}

/** The week after which a waiting Issue is late. */
export const LATE_HOURS = 168

const CLI = 'Manual, from the CLI'
const PLAN = 'Plan, from a plan row'
const CHECK = 'Signal, from a failed check'
const HOOK = 'Webhook, from GitHub'

type Spec = readonly [
  title: string,
  kind: Kind,
  origin: string,
  state: State,
  hours: number,
  attempts: number,
]

/** Longest first inside the file so the default order is the answer; hours are fixed, never random. */
const SPECS: readonly Spec[] = [
  ['Rebase conflicts stall the merge queue', 'fix', CHECK, 'held', 412, 4],
  ['Wait for the owner before changing the deploy window', 'feat', CLI, 'held', 215, 1],
  ['Keep the speed test running after a reboot', 'fix', CHECK, 'paused', 141, 3],
  ['Name each outage by its cause', 'feat', PLAN, 'held', 71, 2],
  ['Add a week view to the speed history', 'feat', PLAN, 'paused', 66, 1],
  ['Drop the unused cache layer', 'chore', CLI, 'ready', 58, 0],
  ['Read the sync rate from the new firmware', 'feat', PLAN, 'ready', 49, 0],
  ['Retry the image upload after a timeout', 'fix', CHECK, 'held', 33, 5],
  ['Compact the outage list at 390', 'fix', HOOK, 'ready', 30, 0],
  ['Show the router uptime on the line page', 'feat', PLAN, 'ready', 27, 0],
  ['Move the nightly job to the new host', 'chore', CLI, 'paused', 24, 2],
  ['Group the noise margin by hour', 'feat', PLAN, 'ready', 21, 0],
  ['Fix the clock drift on the status page', 'fix', HOOK, 'ready', 19, 1],
  ['Rename the line speed columns', 'chore', CLI, 'ready', 16, 0],
  ['Cut the sparkline cost on the overview', 'feat', PLAN, 'ready', 14, 0],
  ['Pin the sidebar footer on short screens', 'fix', HOOK, 'paused', 12, 1],
  ['Log the failed webhook deliveries', 'feat', CHECK, 'ready', 11, 0],
  ['Explain the empty state of the alert list', 'feat', PLAN, 'ready', 9, 0],
  ['Update the outage copy for plain words', 'chore', CLI, 'ready', 8, 0],
  ['Check the dark mode of the heat grid', 'fix', CHECK, 'held', 7, 2],
  ['Stop the retry storm on a dead host', 'fix', CHECK, 'checking', 6, 2],
  ['Add the line profile to the export', 'feat', PLAN, 'checking', 5, 1],
  ['Sort the findings by age', 'feat', PLAN, 'checking', 4, 1],
  ['Remove the old speed endpoint', 'chore', CLI, 'checking', 4, 0],
  ['Fix the focus ring on the date picker', 'fix', HOOK, 'checking', 3, 1],
  ['Show the next test time', 'feat', PLAN, 'checking', 2, 1],
  ['Trim the bundle of the history page', 'chore', CHECK, 'checking', 1, 0],
  ['Keep the old row when a refetch fails', 'fix', HOOK, 'paused', 1, 1],
  ['Add a retry to the line probe', 'feat', PLAN, 'ready', 1, 0],
  ['Name the probe hosts in the legend', 'feat', CLI, 'ready', 0.5, 0],
]

const toIssue = ([title, kind, origin, state, waitHours, attempts]: Spec, i: number): Issue => ({
  id: `#${2417 - i}`,
  title,
  kind,
  origin,
  state,
  waitHours,
  attempts,
})

/** The fixture a `?fixture=` name picks; an unknown name is the default. */
export function issuesFor(fixture: string | undefined): readonly Issue[] {
  const all = SPECS.map(toIssue)
  if (fixture === 'calm') {
    return all
      .map((issue) =>
        issue.waitHours >= LATE_HOURS ? { ...issue, waitHours: issue.waitHours % 96 } : issue,
      )
      .toSorted((a, b) => b.waitHours - a.waitHours)
  }
  if (fixture === 'ancient') {
    return all.map((issue, i) => (i === 0 ? { ...issue, waitHours: 9840 } : issue))
  }
  return all
}
