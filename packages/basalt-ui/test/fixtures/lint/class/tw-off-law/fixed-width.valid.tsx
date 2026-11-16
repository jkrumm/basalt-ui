export const a = (
  <div className="w-96 w-full min-w-0 w-[100%] w-[300px] w-[384px] w-[24rem] max-w-[420px]" />
)
// viewport-keyed reports these: one token, one rule
export const b = (
  <div className="md:w-120 max-md:w-120 hover:lg:min-w-[420px] min-[600px]:w-[420px]" />
)
export const c = <div className="[@media(min-width:900px)]:w-[500px]" />
export const d = <div className="basis-1/3 basis-full basis-0 basis-96 basis-[300px] grow" />
export const e = <div className="max-w-lg max-w-md min-w-6xl w-sm w-xs size-4 size-8 size-96 w-full" />
export const f = <div className="md:w-lg portrait:size-120" />
