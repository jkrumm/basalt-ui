// expect: marginLeft
// expect: paddingRight
// expect: left
// expect: borderLeftWidth
// expect: textAlign
export const a = <div style={{ marginLeft: 8, paddingRight: 4 }} />
export const b = <div style={{ left: 0, borderLeftWidth: 1 }} />
export const c = <p style={{ textAlign: 'left' }} />
