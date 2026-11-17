// expect: mt-4
// expect: mx-2
// expect: m-1
// expect: md:mb-6
// expect: ms-3
// expect: -mt-0.5
// expect: -mx-2
// expect: md:-mt-1
// expect: ml-2
// expect: mt-4
export const a = <div className="mt-4 mx-2 m-1 md:mb-6 ms-3 -mt-0.5 -mx-2 md:-mt-1" />
export const b = ({ open }) => <svg className={`size-4 ${open ? 'ml-2' : ''}`} />
export const c = ({ open }) => <div className={`flex ${open && 'mt-4'}`} />
