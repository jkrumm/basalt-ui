// expect: min-[640px]:flex
// expect: max-[900px]:hidden
// expect: [@media(min-width:900px)]:grid-cols-3
// expect: [@media(max-aspect-ratio:1/1)]:grid-rows-2
// expect: [@media(orientation:portrait)]:hidden
// expect: [@media(min-height:600px)]:flex
// expect: [@media(min-device-width:600px)]:flex
export const a = <div className="min-[640px]:flex max-[900px]:hidden" />
export const b = <div className="grid [@media(min-width:900px)]:grid-cols-3" />
export const c = <div className="[@media(max-aspect-ratio:1/1)]:grid-rows-2 [@media(orientation:portrait)]:hidden" />
export const d = <div className="[@media(min-height:600px)]:flex [@media(min-device-width:600px)]:flex" />
