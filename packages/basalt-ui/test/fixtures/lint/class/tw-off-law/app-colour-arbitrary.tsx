// expect: bg-(--vx-good)
// expect: text-(--vx-warn)
// expect: bg-[var(--vx-brand)]
// expect: border-(--vx-bad-tint)
export const a = <div className="bg-(--vx-good) text-(--vx-warn) bg-[var(--vx-brand)] border-(--vx-bad-tint)" />
