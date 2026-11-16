// expect: w-105
// expect: min-w-120
// expect: w-[420px]
// expect: min-w-[385px]
// expect: @regular:w-[30rem]
// expect: basis-120
// expect: basis-[420px]
// expect: w-lg
// expect: w-md
// expect: basis-xl
// expect: size-120
export const a = <div className="w-105 min-w-120 w-[420px] min-w-[385px] @regular:w-[30rem]" />
export const b = <aside className="basis-120 basis-[420px]" />
export const c = <div className="w-lg w-md basis-xl size-120" />
