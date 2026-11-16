// expect: dark:bg-neutral-900
// expect: dark:hover:text-neutral-50
// expect: data-[theme=dark]:bg-inset
// expect: group-data-[theme=dark]:text-muted
// expect: in-data-[theme=dark]:bg-card
// expect: [[data-theme=dark]_&]:bg-inset
// expect: [[data-theme='dark']_&]:text-muted
// expect: [.dark_&]:bg-card
// expect: data-[theme='dark']:bg-inset
// expect: [@media(prefers-color-scheme:dark)]:bg-inset
// expect: group-data-[theme=dark]/shell:bg-inset
// expect: [html[data-theme=dark]_&]:bg-inset
// expect: [:root.dark_&]:text-muted
// expect: not-dark:bg-card
// expect: [:where([data-theme=dark])_&]:bg-inset
// expect: [:is(.dark)_&]:text-muted
export const a = <div className="flex dark:bg-neutral-900 dark:hover:text-neutral-50" />
export const b = (
  <div className="data-[theme=dark]:bg-inset group-data-[theme=dark]:text-muted in-data-[theme=dark]:bg-card" />
)
export const c = <span className="bg-card [[data-theme=dark]_&]:bg-inset">b</span>
export const d = <span className="[[data-theme='dark']_&]:text-muted">b</span>
export const e = <span className="[.dark_&]:bg-card">b</span>
export const f = <div className="data-[theme='dark']:bg-inset" />
export const g = <div className="[@media(prefers-color-scheme:dark)]:bg-inset" />
export const h = <a className="group-data-[theme=dark]/shell:bg-inset">n</a>
export const i = <span className="[html[data-theme=dark]_&]:bg-inset [:root.dark_&]:text-muted">b</span>
export const j = <section className="not-dark:bg-card">h</section>
export const k = (
  <div className="[:where([data-theme=dark])_&]:bg-inset [:is(.dark)_&]:text-muted">t</div>
)
