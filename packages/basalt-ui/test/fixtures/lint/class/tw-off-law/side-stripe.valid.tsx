// A neutral divider, a tab underline, a transparent rest edge, a neutral pseudo rule and a
// splitter line lit only under hover, focus or drag: none is a colored bar at rest.
export const a = <aside className="border-s border-border" />
export const b = <button className="border-b-2 border-transparent data-active:border-sky-600" />
export const c = <a className="border-l-2 border-transparent" />
export const d = (
  <div className="relative before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border" />
)
export const e = (
  <div className="relative after:absolute after:inset-y-0 after:start-0 after:w-px hover:after:bg-sky-500 focus-visible:after:bg-sky-500 data-dragging:after:bg-sky-500" />
)
export const f = <div className="border-t-2 border-amber-500" />
