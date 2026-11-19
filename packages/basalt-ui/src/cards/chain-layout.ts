/**
 * The geometry of a chain: a layered layout, left to right, of nodes that wait on other nodes. A
 * blocker sits left of what waits on it. No dependency: the graphs a page draws are tens of nodes,
 * where the four classic steps (rank, order, place, route) fit in this file.
 *
 * 1. Rank: a node sits one column right of its rightmost blocker; a node nothing blocks sits one
 *    column left of the first node it blocks, so its edge is short. A cycle's closing edge is
 *    dropped (`dropped` counts them), so every node is drawn exactly once.
 * 2. Order: an edge that spans columns passes through a waypoint in each column it crosses, then
 *    each column is sorted by the mean position of its neighbours, down and up, keeping the order
 *    with the fewest crossings.
 * 3. Place: a node moves to the median height of its blockers where its column leaves room, so a
 *    chain of one blocker each is one straight line.
 * 4. Route: an edge leaves its blocker's right side, runs through its waypoints and enters the
 *    waiting node's left side at a port of its own; a change of height is one rounded step halfway
 *    between two columns.
 */

export type ChainSize = { width: number; height: number; gapX: number; gapY: number }

/** A node card is 200 x 64 px: a title line and a muted line with the status; six ranks fit 1600 px. */
export const CHAIN_SIZE: ChainSize = { width: 200, height: 64, gapX: 64, gapY: 16 }

export type ChainInput = { id: string; waitsOn: readonly string[] }

export type ChainPlaced = { id: string; x: number; y: number; rank: number }

export type ChainRoute = {
  /** The blocker. */
  from: string
  /** The node that waits on it. */
  to: string
  /** SVG path data, ending at the waiting node's left side. */
  path: string
  /** Where the path ends: the arrowhead's tip. */
  end: { x: number; y: number }
}

export type ChainGeometry = {
  nodes: ReadonlyMap<string, ChainPlaced>
  edges: readonly ChainRoute[]
  width: number
  height: number
  /** Edges left out to break a cycle. */
  dropped: number
}

/** Height of a waypoint slot: an edge passing through a column takes this much room in it. */
const WAYPOINT = 8
const SWEEPS = 8
const PORT_STEP = 10
const CORNER = 6

type Edge = { from: string; to: string }

/** Waypoint ids start with a NUL, which no record id carries. */
const isWaypoint = (id: string): boolean => id.startsWith('\u0000')

function edgesOf(inputs: readonly ChainInput[]): { edges: Edge[]; dropped: number } {
  const ids = new Set(inputs.map((n) => n.id))
  const all: Edge[] = []
  const seen = new Set<string>()
  for (const node of inputs) {
    for (const blocker of node.waitsOn) {
      const key = `${blocker}>${node.id}`
      if (blocker === node.id || !ids.has(blocker) || seen.has(key)) continue
      seen.add(key)
      all.push({ from: blocker, to: node.id })
    }
  }
  // Depth-first from each node in input order: an edge into a node still on the stack closes a cycle.
  const out = new Map<string, Edge[]>()
  for (const edge of all) out.set(edge.from, [...(out.get(edge.from) ?? []), edge])
  const state = new Map<string, 'open' | 'done'>()
  const back = new Set<Edge>()
  const visit = (id: string): void => {
    state.set(id, 'open')
    for (const edge of out.get(id) ?? []) {
      const at = state.get(edge.to)
      if (at === 'open') back.add(edge)
      else if (at === undefined) visit(edge.to)
    }
    state.set(id, 'done')
  }
  for (const node of inputs) if (!state.has(node.id)) visit(node.id)
  return { edges: all.filter((edge) => !back.has(edge)), dropped: back.size }
}

function ranksOf(inputs: readonly ChainInput[], edges: readonly Edge[]): Map<string, number> {
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const edge of edges) {
    preds.set(edge.to, [...(preds.get(edge.to) ?? []), edge.from])
    succs.set(edge.from, [...(succs.get(edge.from) ?? []), edge.to])
  }
  const rank = new Map<string, number>()
  const rankOf = (id: string): number => {
    const known = rank.get(id)
    if (known !== undefined) return known
    const r = Math.max(-1, ...(preds.get(id) ?? []).map(rankOf)) + 1
    rank.set(id, r)
    return r
  }
  for (const node of inputs) rankOf(node.id)
  // A source sits just left of the first node it blocks.
  for (const node of inputs) {
    const next = succs.get(node.id) ?? []
    if ((preds.get(node.id) ?? []).length > 0 || next.length === 0) continue
    rank.set(node.id, Math.min(...next.map((id) => rank.get(id) ?? 0)) - 1)
  }
  return rank
}

function crossings(layers: readonly string[][], down: Map<string, string[]>): number {
  let count = 0
  for (let r = 0; r < layers.length - 1; r++) {
    const next = new Map((layers[r + 1] ?? []).map((id, i) => [id, i]))
    const pairs: [number, number][] = []
    ;(layers[r] ?? []).forEach((id, i) => {
      for (const to of down.get(id) ?? []) pairs.push([i, next.get(to) ?? 0])
    })
    for (let a = 0; a < pairs.length; a++) {
      for (let b = a + 1; b < pairs.length; b++) {
        const [a0, a1] = pairs[a] ?? [0, 0]
        const [b0, b1] = pairs[b] ?? [0, 0]
        if ((a0 - b0) * (a1 - b1) < 0) count++
      }
    }
  }
  return count
}

function mean(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((s, v) => s + v, 0) / values.length
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = values.toSorted((a, b) => a - b)
  const mid = (sorted.length - 1) / 2
  return ((sorted[Math.floor(mid)] ?? 0) + (sorted[Math.ceil(mid)] ?? 0)) / 2
}

/** The step from (ax, ay) to (bx, by): straight when level, else one rounded step at `mx`. */
function step(ax: number, ay: number, bx: number, by: number, mx: number): string {
  if (Math.abs(ay - by) < 0.5) return ` L ${bx} ${by}`
  const dir = by > ay ? 1 : -1
  const r = Math.min(CORNER, Math.abs(by - ay) / 2, mx - ax, bx - mx)
  return (
    ` L ${mx - r} ${ay} Q ${mx} ${ay} ${mx} ${ay + dir * r}` +
    ` L ${mx} ${by - dir * r} Q ${mx} ${by} ${mx + r} ${by} L ${bx} ${by}`
  )
}

/** Lays out `inputs` (in reading order: it breaks ties) at `size`. */
export function chainLayout(
  inputs: readonly ChainInput[],
  size: ChainSize = CHAIN_SIZE,
): ChainGeometry {
  const { edges, dropped } = edgesOf(inputs)
  const rank = ranksOf(inputs, edges)

  // Waypoints split every edge into one-column hops.
  const down = new Map<string, string[]>()
  const up = new Map<string, string[]>()
  const link = (a: string, b: string): void => {
    down.set(a, [...(down.get(a) ?? []), b])
    up.set(b, [...(up.get(b) ?? []), a])
  }
  const waypoints = new Map<Edge, string[]>()
  for (const edge of edges) {
    const from = rank.get(edge.from) ?? 0
    const to = rank.get(edge.to) ?? 0
    const points: string[] = []
    let prev = edge.from
    for (let r = from + 1; r < to; r++) {
      const id = `\u0000${edge.from}>${edge.to}#${r}`
      rank.set(id, r)
      points.push(id)
      link(prev, id)
      prev = id
    }
    link(prev, edge.to)
    waypoints.set(edge, points)
  }

  const columns = rank.size === 0 ? 0 : Math.max(0, ...rank.values()) + 1
  let layers: string[][] = Array.from({ length: columns }, () => [])
  for (const node of inputs) layers[rank.get(node.id) ?? 0]?.push(node.id)
  for (const points of waypoints.values())
    for (const id of points) layers[rank.get(id) ?? 0]?.push(id)

  // Order: barycentre sweeps, keeping the order with the fewest crossings.
  let best = layers.map((layer) => [...layer])
  let bestCount = crossings(best, down)
  for (let sweep = 0; sweep < SWEEPS && bestCount > 0; sweep++) {
    const downward = sweep % 2 === 0
    const range = downward
      ? Array.from({ length: columns - 1 }, (_, i) => i + 1)
      : Array.from({ length: columns - 1 }, (_, i) => columns - 2 - i)
    for (const r of range) {
      const near = layers[downward ? r - 1 : r + 1] ?? []
      const at = new Map(near.map((id, i) => [id, i]))
      const layer = layers[r] ?? []
      const keyed = layer.map((id, i) => {
        const neighbours = (downward ? up : down).get(id) ?? []
        return { id, key: mean(neighbours.map((n) => at.get(n) ?? 0)) ?? i }
      })
      layers[r] = keyed.toSorted((a, b) => a.key - b.key).map((k) => k.id)
    }
    const count = crossings(layers, down)
    if (count < bestCount) {
      best = layers.map((layer) => [...layer])
      bestCount = count
    }
  }
  layers = best

  // Place: centres in px, each column packed top-down in order.
  const heightOf = (id: string): number => (isWaypoint(id) ? WAYPOINT : size.height)
  const centre = new Map<string, number>()
  const pack = (layer: readonly string[], want: (id: string) => number | undefined): void => {
    let floor = -Infinity
    const tops = layer.map((id) => {
      const h = heightOf(id)
      const wanted = want(id)
      const top =
        wanted === undefined ? (floor === -Infinity ? 0 : floor) : Math.max(wanted - h / 2, floor)
      floor = top + h + size.gapY
      return top
    })
    // Pull a node back up toward its wish where the next one leaves room.
    for (let i = layer.length - 2; i >= 0; i--) {
      const id = layer[i] ?? ''
      const wanted = want(id)
      const next = tops[i + 1] ?? Infinity
      const top = tops[i] ?? 0
      if (wanted === undefined) continue
      const ideal = wanted - heightOf(id) / 2
      if (ideal > top) tops[i] = Math.min(ideal, next - size.gapY - heightOf(id))
    }
    layer.forEach((id, i) => centre.set(id, (tops[i] ?? 0) + heightOf(id) / 2))
  }
  const fromBlockers = (id: string): number | undefined =>
    median((up.get(id) ?? []).flatMap((n) => (centre.has(n) ? [centre.get(n) ?? 0] : [])))
  const fromWaiting = (id: string): number | undefined =>
    median((down.get(id) ?? []).flatMap((n) => (centre.has(n) ? [centre.get(n) ?? 0] : [])))
  pack(layers[0] ?? [], () => undefined)
  for (let r = 1; r < columns; r++) pack(layers[r] ?? [], fromBlockers)
  // A node nothing blocks follows what it blocks; then the rest re-align to their blockers.
  for (let r = columns - 2; r >= 0; r--) {
    pack(layers[r] ?? [], (id) =>
      (up.get(id) ?? []).length === 0 ? fromWaiting(id) : centre.get(id),
    )
  }
  for (let r = 1; r < columns; r++) pack(layers[r] ?? [], fromBlockers)

  let top = Infinity
  let bottom = -Infinity
  for (const [id, c] of centre) {
    top = Math.min(top, c - heightOf(id) / 2)
    bottom = Math.max(bottom, c + heightOf(id) / 2)
  }
  if (!Number.isFinite(top)) top = bottom = 0
  const xOf = (r: number): number => r * (size.width + size.gapX)
  const yOf = (id: string): number => (centre.get(id) ?? 0) - top

  const nodes = new Map<string, ChainPlaced>()
  for (const node of inputs) {
    const r = rank.get(node.id) ?? 0
    nodes.set(node.id, { id: node.id, rank: r, x: xOf(r), y: yOf(node.id) - size.height / 2 })
  }

  // Ports: the edges into one node enter at their own heights, in the order their last hop arrives.
  const into = new Map<string, { edge: Edge; from: number }[]>()
  for (const edge of edges) {
    const last = (waypoints.get(edge) ?? []).at(-1) ?? edge.from
    into.set(edge.to, [...(into.get(edge.to) ?? []), { edge, from: yOf(last) }])
  }
  // An edge level with the node keeps the middle port, so its line stays straight; the others step
  // above and below it in the order they arrive. Edges from one height share a port.
  const port = new Map<Edge, number>()
  for (const [id, list] of into) {
    const mid = yOf(id)
    const heights = [...new Set(list.map((entry) => entry.from))].toSorted((a, b) => a - b)
    const level = heights.findIndex((h) => Math.abs(h - mid) < 0.5)
    const middle = level === -1 ? (heights.length - 1) / 2 : level
    const farthest = Math.max(middle, heights.length - 1 - middle)
    const stepY = farthest === 0 ? 0 : Math.min(PORT_STEP, (size.height / 2 - 8) / farthest)
    for (const entry of list) {
      port.set(entry.edge, (heights.indexOf(entry.from) - middle) * stepY)
    }
  }

  // Hops: one per gap an edge crosses, from a node or waypoint on the left to the next on the right.
  type Hop = { source: string; gap: number; ay: number; by: number }
  const hopsOf = new Map<Edge, Hop[]>()
  for (const edge of edges) {
    const chain = [edge.from, ...(waypoints.get(edge) ?? [])]
    const hops = chain.map((source, i) => {
      const next = chain[i + 1]
      return {
        source,
        gap: rank.get(source) ?? 0,
        ay: yOf(source),
        by: next === undefined ? yOf(edge.to) + (port.get(edge) ?? 0) : yOf(next),
      }
    })
    hopsOf.set(edge, hops)
  }
  // Channels: in each gap every source whose hops turn gets a vertical run of its own, spread across
  // the gap in the order the sources sit, so two trunks never share a line. A fan-out shares one.
  const channel = new Map<string, number>()
  const turning = new Map<number, Map<string, number>>()
  for (const hops of hopsOf.values()) {
    for (const hop of hops) {
      if (Math.abs(hop.ay - hop.by) < 0.5) continue
      const gap = turning.get(hop.gap) ?? new Map<string, number>()
      gap.set(hop.source, hop.ay)
      turning.set(hop.gap, gap)
    }
  }
  for (const [gap, sources] of turning) {
    const left = xOf(gap) + size.width
    const sorted = [...sources].toSorted((a, b) => a[1] - b[1])
    sorted.forEach(([source], i) => {
      channel.set(
        `${gap}:${source}`,
        Math.round(left + (size.gapX * (i + 1)) / (sorted.length + 1)),
      )
    })
  }

  const routes: ChainRoute[] = edges.map((edge) => {
    const hops = hopsOf.get(edge) ?? []
    const first = hops[0]
    let path = `M ${xOf(first?.gap ?? 0) + size.width} ${first?.ay ?? 0}`
    let end = { x: 0, y: 0 }
    hops.forEach((hop, i) => {
      const ax = xOf(hop.gap) + size.width
      const bx = xOf(hop.gap + 1)
      const mx = channel.get(`${hop.gap}:${hop.source}`) ?? (ax + bx) / 2
      if (i > 0) path += ` L ${ax} ${hop.ay}`
      path += step(ax, hop.ay, bx, hop.by, mx)
      end = { x: bx, y: hop.by }
    })
    return { from: edge.from, to: edge.to, path, end }
  })

  return {
    nodes,
    edges: routes,
    width: columns === 0 ? 0 : xOf(columns - 1) + size.width,
    height: bottom - top,
    dropped,
  }
}
