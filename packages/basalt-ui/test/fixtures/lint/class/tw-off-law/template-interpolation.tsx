// expect: bg-${}-600
// expect: text-${}
// expect: ${}-brand
// expect: ${}:hidden
export const a = <div className={`flex bg-${tone}-600 text-${tone}`} />
export const b = <span className={`${solid ? 'bg' : 'text'}-brand`}>t</span>
export const c = <div className={`${at}:hidden`}>h</div>
