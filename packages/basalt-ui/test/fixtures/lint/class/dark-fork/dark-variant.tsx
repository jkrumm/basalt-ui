// expect: dark:bg-neutral-900
// expect: dark:hover:text-neutral-50
// expect: data-[theme=dark]:bg-inset
// expect: group-data-[theme=dark]:text-muted
// expect: in-data-[theme=dark]:bg-card
// expect: [[data-theme=dark]_&]:bg-inset
// expect: [[data-theme='dark']_&]:text-muted
// expect: [.dark_&]:bg-card
export const a = <div className="flex dark:bg-neutral-900 dark:hover:text-neutral-50" />
export const b = (
  <div className="data-[theme=dark]:bg-inset group-data-[theme=dark]:text-muted in-data-[theme=dark]:bg-card" />
)
export const c = <span className="bg-card [[data-theme=dark]_&]:bg-inset">b</span>
export const d = <span className="[[data-theme='dark']_&]:text-muted">b</span>
export const e = <span className="[.dark_&]:bg-card">b</span>
