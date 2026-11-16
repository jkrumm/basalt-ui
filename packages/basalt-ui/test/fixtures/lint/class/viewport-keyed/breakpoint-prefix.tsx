// expect: max-md:flex
// expect: lg:grid
// expect: hover:xl:p-2
// expect: md:w-120
// expect: md:grid-cols-3
export const a = <div className="max-md:flex lg:grid hover:xl:p-2" />
export const b = <div className="md:w-120" />
const gridClass = 'grid gap-4 md:grid-cols-3'
export const c = <div className={gridClass}>tiles</div>
