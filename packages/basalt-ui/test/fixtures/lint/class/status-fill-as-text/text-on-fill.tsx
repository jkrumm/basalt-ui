// expect: text-brand-fill
// expect: text-chart-1
// expect: text-dim-bar
// expect: hover:text-seq-3
// expect: text-(--basalt-brand-fill)
// expect: text-[var(--basalt-chart-1)]
// expect: text-[--basalt-dim-bar]
// expect: text-(color:--basalt-chart-1)
// expect: text-[color:var(--basalt-seq-2)]
export const a = <div className="text-brand-fill text-chart-1 text-dim-bar hover:text-seq-3" />
export const b = (
  <div className="text-(--basalt-brand-fill) text-[var(--basalt-chart-1)] text-[--basalt-dim-bar]" />
)
export const c = <span className="text-(color:--basalt-chart-1) text-[color:var(--basalt-seq-2)]">r</span>
