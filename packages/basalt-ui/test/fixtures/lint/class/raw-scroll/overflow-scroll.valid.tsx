export const a = (
  <div className="overflow-hidden overflow-visible overflow-clip overscroll-contain" />
)
const unusedBox = 'max-h-80 overflow-y-auto'
const frame = 'overflow-hidden'
export const b = <div className={frame} />
export const c = <ul data-box={unusedBox} />
