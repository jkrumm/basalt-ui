/**
 * The edge paths of the kit's drawings, one home for `chainLayout`'s hop and `FlowCanvas`'s elbow.
 * Every path runs in drawing units (unscaled px), left to right, and ends where its arrowhead's tip
 * sits, so a marker with `orient="auto"` points along the last segment.
 */

export type EdgePoint = { x: number; y: number }

/** A box an edge leaves or enters, in drawing units. */
export type EdgeBox = { x: number; y: number; width: number; height: number }

/**
 * One column gap of a chain: from `(ax, ay)` on a right side to `(bx, by)` on a left side. Level
 * ends are a straight line, others one cubic curve whose handles sit halfway across the gap.
 */
export function hop(ax: number, ay: number, bx: number, by: number): string {
  const k = (bx - ax) / 2
  return Math.abs(ay - by) < 0.5
    ? ` L ${bx} ${by}`
    : ` C ${ax + k} ${ay} ${bx - k} ${by} ${bx} ${by}`
}

export type ElbowOptions = {
  /** How far the edge runs out of its source before it turns. */
  lead: number
  /** The radius of each turn; a short run takes a smaller one. */
  radius: number
}

const round = (n: number): number => Math.round(n * 100) / 100

/**
 * A right-angled edge with rounded turns from the middle of `from`'s right side. A target to the
 * right is entered at the middle of its left side: out by `lead`, along, and in. A target that is
 * not (the same column, or behind) is entered at the middle of its right side, the edge looping out
 * to the right of both boxes and back. Level ends are one straight line.
 */
export function elbowPath(
  from: EdgeBox,
  to: EdgeBox,
  { lead, radius }: ElbowOptions,
): { path: string; end: EdgePoint } {
  const sx = from.x + from.width
  const sy = from.y + from.height / 2
  const ty = to.y + to.height / 2
  const ahead = to.x >= sx + lead
  const tx = ahead ? to.x : to.x + to.width
  const end = { x: round(tx), y: round(ty) }
  if (ahead && Math.abs(ty - sy) < 0.5) {
    return { path: `M ${round(sx)} ${round(sy)} H ${end.x}`, end }
  }
  // The vertical run: `lead` past the source, or past whichever box reaches further right.
  const mx = ahead ? sx + lead : Math.max(sx, tx) + lead
  const dy = Math.sign(ty - sy)
  const r = Math.max(0, Math.min(radius, Math.abs(ty - sy) / 2, mx - sx, Math.abs(mx - tx)))
  // Out to the right, turn, run vertically, turn back toward the target.
  const down = dy > 0
  const firstSweep = down ? 1 : 0
  const inward = ahead ? 1 : -1
  const secondSweep = (down ? 0 : 1) ^ (ahead ? 0 : 1)
  const path = [
    `M ${round(sx)} ${round(sy)}`,
    `H ${round(mx - r)}`,
    `A ${round(r)} ${round(r)} 0 0 ${firstSweep} ${round(mx)} ${round(sy + dy * r)}`,
    `V ${round(ty - dy * r)}`,
    `A ${round(r)} ${round(r)} 0 0 ${secondSweep} ${round(mx + inward * r)} ${end.y}`,
    `H ${end.x}`,
  ].join(' ')
  return { path, end }
}
