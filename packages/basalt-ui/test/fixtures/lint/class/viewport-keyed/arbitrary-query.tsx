// expect: min-[640px]:flex
// expect: max-[900px]:hidden
// expect: [@media(min-width:900px)]:grid-cols-3
export const a = <div className="min-[640px]:flex max-[900px]:hidden" />
export const b = <div className="grid [@media(min-width:900px)]:grid-cols-3" />
