export const a = (
  <div className="w-96 w-full min-w-0 w-[100%] w-[300px] w-[384px] w-[24rem] max-w-[420px]" />
)
// viewport-keyed reports these: one token, one rule
export const b = (
  <div className="md:w-120 max-md:w-120 hover:lg:min-w-[420px] min-[600px]:w-[420px]" />
)
export const c = <div className="[@media(min-width:900px)]:w-[500px]" />
