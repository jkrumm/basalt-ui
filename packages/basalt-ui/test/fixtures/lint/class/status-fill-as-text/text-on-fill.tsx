// expect: text-brand-fill
// expect: text-chart-1
// expect: text-dim-bar
// expect: hover:text-seq-3
// expect: text-(--vx-brand-fill)
// expect: text-[var(--vx-chart-1)]
// expect: text-[--vx-dim-bar]
// expect: text-(color:--vx-chart-1)
// expect: text-[color:var(--vx-seq-2)]
export const a = <div className="text-brand-fill text-chart-1 text-dim-bar hover:text-seq-3" />
export const b = (
  <div className="text-(--vx-brand-fill) text-[var(--vx-chart-1)] text-[--vx-dim-bar]" />
)
export const c = <span className="text-(color:--vx-chart-1) text-[color:var(--vx-seq-2)]">r</span>
