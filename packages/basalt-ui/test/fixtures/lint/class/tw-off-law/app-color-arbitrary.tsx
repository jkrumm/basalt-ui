// expect: bg-(--basalt-good)
// expect: text-(--basalt-warn)
// expect: bg-[var(--basalt-brand)]
// expect: border-(--basalt-bad-tint)
// expect: bg-(color:--basalt-warn-tint)
// expect: border-[color:var(--basalt-brand)]
// expect: bg-(--brand-blue)
// expect: text-(--brand-ink)
// expect: bg-[var(--my-divider)]
// expect: text-[color:var(--my-color)]
// expect: shadow-(color:--my-glow)
export const a = (
  <div className="bg-(--basalt-good) text-(--basalt-warn) bg-[var(--basalt-brand)] border-(--basalt-bad-tint)" />
)
export const b = (
  <span className="bg-(color:--basalt-warn-tint) border-[color:var(--basalt-brand)]">w</span>
)
export const c = <div className="bg-(--brand-blue) text-(--brand-ink) bg-[var(--my-divider)]" />
export const d = <div className="text-[color:var(--my-color)] shadow-(color:--my-glow)" />
