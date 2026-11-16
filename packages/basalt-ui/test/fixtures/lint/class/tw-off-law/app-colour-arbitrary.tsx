// expect: bg-(--vx-good)
// expect: text-(--vx-warn)
// expect: bg-[var(--vx-brand)]
// expect: border-(--vx-bad-tint)
// expect: bg-(color:--vx-warn-tint)
// expect: border-[color:var(--vx-brand)]
// expect: bg-(--brand-blue)
// expect: text-(--brand-ink)
// expect: bg-[var(--my-divider)]
// expect: text-[color:var(--my-colour)]
// expect: shadow-(color:--my-glow)
export const a = (
  <div className="bg-(--vx-good) text-(--vx-warn) bg-[var(--vx-brand)] border-(--vx-bad-tint)" />
)
export const b = <span className="bg-(color:--vx-warn-tint) border-[color:var(--vx-brand)]">w</span>
export const c = <div className="bg-(--brand-blue) text-(--brand-ink) bg-[var(--my-divider)]" />
export const d = <div className="text-[color:var(--my-colour)] shadow-(color:--my-glow)" />
