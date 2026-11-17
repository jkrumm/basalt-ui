// expect: !p-0
// expect: p-0!
// expect: grid-cols-1!
// expect: md:!flex
// expect: hidden!
// expect: flex!
// expect: truncate!
// expect: hover:underline!
export const a = <div className="!p-0 p-0! grid-cols-1! md:!flex" />
export const b = <div className="hidden! flex! truncate! hover:underline!" />
