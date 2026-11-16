// expect: bg-card
// expect: shadow-card
// expect: rounded-card
// expect: bg-inset
// expect: hover:bg-card/50
// expect: rounded-lg border p-4
// expect: rounded-xl border py-6
// expect: rounded-lg ring-1 p-4
export const a = <div className="bg-card shadow-card rounded-card bg-inset hover:bg-card/50" />
export const b = <div className="rounded-lg border border-border p-4">bordered</div>
export const c = <div className="flex flex-col gap-6 rounded-xl border py-6 shadow-sm">card</div>
export const d = <div className="rounded-lg p-4 ring-1 ring-border">card</div>
