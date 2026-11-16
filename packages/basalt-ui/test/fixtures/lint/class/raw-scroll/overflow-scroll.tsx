// expect: overflow-auto
// expect: overflow-y-scroll
// expect: md:overflow-x-auto
// expect: overflow-y-auto
// expect: overflow-y-auto
export const a = <div className="overflow-auto overflow-y-scroll md:overflow-x-auto" />
const listBox = 'max-h-80 overflow-y-auto'
export const b = <ul className={cn(listBox, listBox)}>l</ul>
