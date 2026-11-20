// expect: duration-300
// expect: motion-safe:delay-[120ms]
// expect: ease-linear
// expect: data-[state=open]:duration-(--slow)
export const a = (
  <div className="duration-300 motion-safe:delay-[120ms] ease-linear data-[state=open]:duration-(--slow)" />
)
