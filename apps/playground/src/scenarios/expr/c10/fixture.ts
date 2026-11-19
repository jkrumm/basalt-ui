export type Kind = 'key' | 'role' | 'service' | 'bucket' | 'database' | 'secret'

type Resource = { id: string; kind: Kind; affected: boolean }

/** A resource with its distance from the leaked key; `hop` is null when no path reaches it. */
export type Reach = Resource & { hop: number | null; via: string | null }

export type Graph = { origin: string; resources: readonly Resource[]; edges: readonly Edge[] }

type Edge = readonly [from: string, to: string]

export const KIND_LABEL: Record<Kind, string> = {
  key: 'Key',
  role: 'Role',
  service: 'Service',
  bucket: 'Bucket',
  database: 'Database',
  secret: 'Secret',
}

const ORIGIN = 'ci-deploy-key'

const RESOURCES: readonly Resource[] = [
  { id: ORIGIN, kind: 'key', affected: true },
  { id: 'role-ci-deployer', kind: 'role', affected: true },
  { id: 'svc-build-runner', kind: 'service', affected: false },
  { id: 'bucket-artifacts', kind: 'bucket', affected: true },
  { id: 'secret-registry-token', kind: 'secret', affected: true },
  { id: 'db-build-cache', kind: 'database', affected: false },
  { id: 'svc-release-api', kind: 'service', affected: false },
  { id: 'role-release', kind: 'role', affected: false },
  { id: 'role-prod-reader', kind: 'role', affected: false },
  { id: 'db-orders', kind: 'database', affected: false },
  { id: 'svc-payments', kind: 'service', affected: false },
  { id: 'secret-db-backup-key', kind: 'secret', affected: false },
  { id: 'db-ledger', kind: 'database', affected: false },
  { id: 'bucket-backups', kind: 'bucket', affected: false },
  { id: 'svc-docs', kind: 'service', affected: false },
  { id: 'svc-cron-sync', kind: 'service', affected: false },
  { id: 'role-readonly', kind: 'role', affected: false },
  { id: 'bucket-public-assets', kind: 'bucket', affected: false },
  { id: 'db-analytics', kind: 'database', affected: false },
  { id: 'secret-old-signing', kind: 'secret', affected: false },
]

const EDGES: readonly Edge[] = [
  [ORIGIN, 'role-ci-deployer'],
  [ORIGIN, 'svc-build-runner'],
  ['role-ci-deployer', 'bucket-artifacts'],
  ['role-ci-deployer', 'secret-registry-token'],
  ['svc-build-runner', 'secret-registry-token'],
  ['svc-build-runner', 'db-build-cache'],
  ['bucket-artifacts', 'svc-release-api'],
  ['secret-registry-token', 'role-release'],
  ['svc-release-api', 'role-prod-reader'],
  ['svc-release-api', 'db-orders'],
  ['role-release', 'svc-payments'],
  ['db-orders', 'secret-db-backup-key'],
  ['svc-payments', 'db-ledger'],
  ['secret-db-backup-key', 'bucket-backups'],
  ['svc-docs', 'bucket-public-assets'],
  ['svc-cron-sync', 'db-analytics'],
  ['role-readonly', 'bucket-public-assets'],
  ['db-analytics', 'secret-old-signing'],
]

/** The extreme: db-ledger leads on through every resource the key could not reach, ending 9 hops out. */
const SPRAWL_EDGES: readonly Edge[] = [
  ['db-ledger', 'db-analytics'],
  ['db-analytics', 'svc-docs'],
  ['svc-docs', 'role-readonly'],
  ['role-readonly', 'svc-cron-sync'],
  ['svc-cron-sync', 'bucket-public-assets'],
  ['bucket-public-assets', 'secret-old-signing'],
]

/** The zero: the key is valid but nothing grants it a path onward. */
const CONTAINED_EDGES: readonly Edge[] = EDGES.filter(([from]) => from !== ORIGIN)

export function graphFor(fixture: string | undefined): Graph {
  if (fixture === 'contained') {
    const resources = RESOURCES.map((r) => ({ ...r, affected: r.id === ORIGIN }))
    return { origin: ORIGIN, resources, edges: CONTAINED_EDGES }
  }
  if (fixture === 'sprawl') {
    const resources = RESOURCES.map((r) => ({ ...r, affected: true }))
    return { origin: ORIGIN, resources, edges: [...EDGES, ...SPRAWL_EDGES] }
  }
  return { origin: ORIGIN, resources: RESOURCES, edges: EDGES }
}

/** Breadth-first from the origin: every resource with its shortest distance and the step before it. */
export function reach(graph: Graph): readonly Reach[] {
  const hops = new Map<string, { hop: number; via: string | null }>([
    [graph.origin, { hop: 0, via: null }],
  ])
  const queue = [graph.origin]
  for (const from of queue) {
    const next = (hops.get(from)?.hop ?? 0) + 1
    for (const [a, b] of graph.edges) {
      if (a !== from || hops.has(b)) continue
      hops.set(b, { hop: next, via: from })
      queue.push(b)
    }
  }
  return graph.resources
    .map((r) => ({ ...r, hop: hops.get(r.id)?.hop ?? null, via: hops.get(r.id)?.via ?? null }))
    .toSorted((a, b) => (a.hop ?? Infinity) - (b.hop ?? Infinity))
}
