// expect: bg-card
// expect: shadow-card
// expect: rounded-card
// expect: bg-inset
// expect: hover:bg-card/50
// expect: rounded-lg border p-4
// expect: rounded-xl border py-6
// expect: rounded-lg ring-1 p-4
// expect: rounded-(--vx-radius-card) border shadow-sm
// expect: rounded-ctrl border shadow-sm
// expect: rounded-[10px] ring-1 shadow
// expect: rounded-lg outline p-4
// expect: rounded-ctrl outline p-4
// expect: rounded-lg border shadow-sm
// expect: rounded-lg border-1 p-4
// expect: rounded-ctrl border shadow-sm
// expect: rounded-ctrl border-1 p-4
// expect: rounded-md border shadow-sm
// expect: rounded-md border shadow-sm
export const a = <div className="bg-card shadow-card rounded-card bg-inset hover:bg-card/50" />
export const b = <div className="rounded-lg border border-border p-4">bordered</div>
export const c = <div className="flex flex-col gap-6 rounded-xl border py-6 shadow-sm">card</div>
export const d = <div className="rounded-lg p-4 ring-1 ring-border">card</div>
export const e = <div className="rounded-(--vx-radius-card) border shadow-sm">t</div>
export const f = <div className="rounded-ctrl border shadow-sm">t</div>
export const g = <div className="rounded-[10px] ring-1 shadow">t</div>
export const h = <div className="rounded-lg outline outline-hairline p-4">t</div>
export const i = <div className="rounded-ctrl outline outline-border p-4">t</div>
export const j = <div className="flex items-center rounded-lg border px-4 py-2 shadow-sm">banner</div>
export const k = <div className="rounded-lg border-1 border-border p-4">box</div>
export const l = <div className="flex items-center rounded-ctrl border px-4 py-2 shadow-sm" />
export const m = <div className="rounded-ctrl border-1 border-border p-4" />
// a plain div owns no control's shadow, whatever its padding or height
export const n = <div className="group/trigger flex w-full items-center rounded-md border px-3 py-2 shadow-sm" />
export const o = <div className="rounded-md border h-9 shadow-sm" />
