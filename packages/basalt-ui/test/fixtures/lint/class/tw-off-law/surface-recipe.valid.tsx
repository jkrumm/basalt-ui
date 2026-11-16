export const a = <div className="bg-background text-foreground" />
export const b = <div className="dark:bg-card card-title" />
export const c = <div className="rounded-ctrl border border-dashed border-input p-4" />
export const d = <span className="rounded-full border px-2 p-1" />
export const e = <div className="rounded-lg border" />
export const f = <div className="rounded-lg p-4" />
export const g = <div className="in-data-[theme=dark]:bg-card group-dark:bg-inset" />
export const h = <button className="rounded-md border px-4 py-2 focus-visible:ring-2">go</button>
export const i = <div className="rounded-lg p-4 focus-visible:ring-2 ring-offset-2">x</div>
export const j = <div className="rounded-lg py-2 ring-1" />
export const quotedDark = <div className="data-[theme='dark']:bg-inset" />
export const mediaDark = <div className="[@media(prefers-color-scheme:dark)]:bg-card" />
export const k = <input className="rounded-md border px-3 py-1 shadow-xs" />
export const l = <div className="rounded-lg shadow-sm" />
export const m = <div className="rounded-full border shadow-md" />
// hand-built controls with a shadow (tremor Button, Input, Select), primitive-bypass's
export const n = (
  <button className="relative inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-sm transition-all duration-100 ease-in-out" />
)
export const o = (
  <input className="relative block w-full appearance-none rounded-md border px-2.5 py-2 shadow-sm outline-none transition sm:text-sm" />
)
export const p = (
  <label className="group/trigger cursor-pointer flex w-full select-none items-center justify-between gap-2 truncate rounded-md border px-3 py-2 shadow-sm outline-none transition sm:text-sm" />
)
export const q = <select className="rounded-md border h-9 shadow-sm" />
export const r = <div className="rounded-lg outline-none p-4 outline-hidden outline-offset-2 focus-visible:outline-2" />
export const s = <div className="rounded-lg outline-offset-2 p-4 hover:outline" />
export const t = <a className="inline-flex rounded-md border px-4 py-2 shadow-sm">go</a>
export const field = cva('flex items-center rounded-md border px-4 py-2 shadow-sm')
export const u = <Trigger className="flex items-center rounded-md border px-4 py-2 shadow-sm" />
