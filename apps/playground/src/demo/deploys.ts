/**
 * The deploys of the states page (`/kit/states`): one day of a small fleet, newest first, each with
 * the steps its pipeline ran. Fixed times, so a frame is the same on every run.
 */
import type { StepRailRow } from 'basalt-ui/cards'

export const DEPLOY_STATES = ['Live', 'Failed', 'Rolled back'] as const
export type DeployState = (typeof DEPLOY_STATES)[number]

export type Deploy = {
  id: string
  service: string
  version: string
  state: DeployState
  author: string
  at: number
}

export const DEPLOYS_NOW = Date.UTC(2026, 10, 24, 9, 30)
const MIN = 60_000

export const DEPLOYS: readonly Deploy[] = [
  {
    id: 'd-118',
    service: 'billing',
    version: '4.12.0',
    state: 'Live',
    author: 'Ada',
    at: DEPLOYS_NOW - 4 * MIN,
  },
  {
    id: 'd-117',
    service: 'search',
    version: '2.8.3',
    state: 'Failed',
    author: 'Lin',
    at: DEPLOYS_NOW - 38 * MIN,
  },
  {
    id: 'd-116',
    service: 'checkout',
    version: '7.1.0',
    state: 'Live',
    author: 'Ada',
    at: DEPLOYS_NOW - 95 * MIN,
  },
  {
    id: 'd-115',
    service: 'auth',
    version: '3.0.4',
    state: 'Rolled back',
    author: 'Sam',
    at: DEPLOYS_NOW - 180 * MIN,
  },
  {
    id: 'd-114',
    service: 'search',
    version: '2.8.2',
    state: 'Live',
    author: 'Lin',
    at: DEPLOYS_NOW - 310 * MIN,
  },
  {
    id: 'd-113',
    service: 'notifications',
    version: '1.4.1',
    state: 'Live',
    author: 'Mo',
    at: DEPLOYS_NOW - 520 * MIN,
  },
]

const STEP_PLAN = [
  { id: 'checkout', label: 'Check out the commit', ms: 4_000 },
  { id: 'build', label: 'Build the image', ms: 96_000 },
  { id: 'test', label: 'Run the test suite', ms: 182_000 },
  { id: 'push', label: 'Push to the registry', ms: 21_000 },
  { id: 'rollout', label: 'Roll out to production', ms: 64_000 },
  { id: 'probe', label: 'Probe the health check', ms: 9_000 },
] as const

/** The steps one deploy ran: a failed deploy stops at its probe, a rolled-back one adds the rollback. */
export function stepsOf(deploy: Deploy): StepRailRow[] {
  let at = deploy.at - STEP_PLAN.reduce((sum, step) => sum + step.ms, 0)
  const steps: StepRailRow[] = STEP_PLAN.map((step) => {
    at += step.ms
    return { id: step.id, label: step.label, durationMs: step.ms, at, tone: 'good' }
  })
  const last = steps.at(-1)
  if (deploy.state === 'Failed' && last !== undefined) {
    last.tone = 'bad'
    last.detail = 'GET /health answered 503 three times in a row'
  }
  if (deploy.state === 'Rolled back') {
    steps.push({
      id: 'rollback',
      label: 'Roll back to the previous version',
      durationMs: 38_000,
      at: at + 38_000,
      tone: 'warn',
      detail: 'Error rate above 2 % for five minutes',
    })
  }
  return steps
}
