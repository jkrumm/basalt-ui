// expect: grid-cols-[200px_1fr]
// expect: grid-cols-[16rem_1fr]
// expect: @regular:grid-cols-[240px_1fr]
// expect: grid-rows-[48px_1fr]
export const a = (
  <div className="grid-cols-[200px_1fr] grid-cols-[16rem_1fr] @regular:grid-cols-[240px_1fr] grid-rows-[48px_1fr]" />
)
