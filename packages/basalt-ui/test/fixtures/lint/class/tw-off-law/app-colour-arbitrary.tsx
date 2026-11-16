// expect: bg-(--vx-good)
// expect: text-(--vx-warn)
// expect: bg-[var(--vx-brand)]
// expect: border-(--vx-bad-tint)
// expect: bg-(color:--vx-warn-tint)
// expect: border-[color:var(--vx-brand)]
export const a = (
  <div className="bg-(--vx-good) text-(--vx-warn) bg-[var(--vx-brand)] border-(--vx-bad-tint)" />
)
export const b = <span className="bg-(color:--vx-warn-tint) border-[color:var(--vx-brand)]">w</span>
