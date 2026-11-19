// expect: border-l-4 border-amber-500
// expect: border-s-2 border-s-rose-500
// expect: data-[orientation=vertical]:border-r-2 data-active:border-sky-600
// expect: before:bg-amber-400 before:w-0.5
// expect: after:bg-emerald-500 after:w-1
// expect: data-blocked:before:bg-amber-400 before:w-px
export const a = <div className="rounded-lg border-l-4 border-amber-500 px-3" />
export const b = <li className="flex border-s-2 border-s-rose-500" />
export const c = (
  <button className="data-[orientation=vertical]:border-r-2 data-active:border-sky-600" />
)
export const d = (
  <div className="relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber-400" />
)
export const e = (
  <div className="relative after:absolute after:top-0 after:bottom-0 after:end-0 after:w-1 after:bg-emerald-500" />
)
export const f = (
  <div className="relative before:absolute before:inset-y-0 before:start-0 before:w-px data-blocked:before:bg-amber-400" />
)
