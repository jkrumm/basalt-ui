/**
 * One Spec in review (scenario expr-n55): five revisions, each sent at a time with a size, answered by
 * a verdict that waited some hours, and 14 annotations that each sit on a revision and either got a
 * reply or did not. The data is a fixed literal, so every render and every shot is identical.
 */

export type Outcome = 'changes' | 'good'
export type Reply = 'applied' | 'deferred' | 'declined' | 'none'

export type Revision = {
  id: string
  /** The revision number, 1 to 5. */
  n: number
  name: string
  /** Sent time, ISO in UTC. */
  sentAt: string
  bytes: number
  outcome: Outcome
  /** Hours from sending to the verdict. */
  hours: number
}

export type Annotation = {
  id: string
  note: string
  section: string
  /** The revision the annotation was made on. */
  revision: number
  reply: Reply
}

export type Review = {
  spec: string
  revisions: readonly Revision[]
  annotations: readonly Annotation[]
}

export const SPEC_NAME = 'Spec 214, rollout retry budget'

const rev = (
  n: number,
  sentAt: string,
  bytes: number,
  outcome: Outcome,
  hours: number,
): Revision => ({
  id: `r${n}`,
  n,
  name: `Revision ${n}`,
  sentAt,
  bytes,
  outcome,
  hours,
})

/** The extreme is revision 2: its verdict waited 26 hours, against 1.5 to 7 for the others. */
const REVISIONS: readonly Revision[] = [
  rev(1, '2026-11-03T09:12:00Z', 4812, 'changes', 4.5),
  rev(2, '2026-11-04T11:40:00Z', 5640, 'changes', 26),
  rev(3, '2026-11-06T08:05:00Z', 6105, 'changes', 7),
  rev(4, '2026-11-07T07:30:00Z', 6380, 'changes', 2.5),
  rev(5, '2026-11-07T14:20:00Z', 6420, 'good', 1.5),
]

const note = (
  id: number,
  revision: number,
  section: string,
  text: string,
  reply: Reply,
): Annotation => ({ id: `a${id}`, note: text, section, revision, reply })

const ANNOTATIONS: readonly Annotation[] = [
  note(1, 1, 'Goals', 'Name the retry budget in the goals', 'applied'),
  note(2, 1, 'Scope', 'Say which deploy steps retry', 'applied'),
  note(3, 1, 'Design', 'Add jitter to the backoff', 'deferred'),
  note(4, 2, 'Design', 'State the budget per deploy, not per step', 'applied'),
  note(5, 2, 'Goals', 'Link the incident that motivates this', 'applied'),
  note(6, 2, 'Scope', 'Drop the manual override flag', 'declined'),
  note(7, 2, 'Rollback', 'What happens when the registry is down?', 'none'),
  note(8, 3, 'Design', 'Cap total retry time at ten minutes', 'applied'),
  note(9, 3, 'Tests', 'Cover retry exhaustion in the test plan', 'deferred'),
  note(
    10,
    3,
    'Metrics',
    'Which metric proves the budget works, and what threshold ends the rollout if it stays above target for a full week of deploys?',
    'none',
  ),
  note(11, 4, 'Rollback', 'Split the rollout into two phases', 'declined'),
  note(12, 4, 'Metrics', 'Name an owner for the budget', 'none'),
  note(13, 4, 'Design', 'Fix the table of backoff times', 'applied'),
  note(14, 5, 'Scope', 'Confirm the budget applies to rollback deploys', 'none'),
]

/** The zero case: every annotation has its reply, so nothing is unanswered. */
const ALL_ANSWERED: readonly Annotation[] = ANNOTATIONS.map((a) =>
  a.reply === 'none' ? { ...a, reply: 'applied' } : a,
)

export const EMPTY_REVIEW: Review = { spec: SPEC_NAME, revisions: [], annotations: [] }

/** `?fixture=answered` is the zero case; any other value is the review at rest. */
export function reviewFor(fixture: string | undefined): Review {
  return {
    spec: SPEC_NAME,
    revisions: REVISIONS,
    annotations: fixture === 'answered' ? ALL_ANSWERED : ANNOTATIONS,
  }
}
