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
export const a = <div className="bg-card shadow-card rounded-card bg-inset hover:bg-card/50" />
export const b = <div className="rounded-lg border border-border p-4">bordered</div>
export const c = <div className="flex flex-col gap-6 rounded-xl border py-6 shadow-sm">card</div>
export const d = <div className="rounded-lg p-4 ring-1 ring-border">card</div>
export const e = <div className="rounded-(--vx-radius-card) border shadow-sm">t</div>
export const f = <div className="rounded-ctrl border shadow-sm">t</div>
export const g = <div className="rounded-[10px] ring-1 shadow">t</div>
export const h = <div className="rounded-lg outline outline-hairline p-4">t</div>
export const i = <div className="rounded-ctrl outline outline-border p-4">t</div>
