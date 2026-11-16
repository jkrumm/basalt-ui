export const a = window.matchMedia('(prefers-reduced-motion: reduce)')
export const b = useMediaQuery('(pointer: coarse)')
export const c = matchMedia(query)
export const d = matchMedia('(prefers-color-scheme: dark)')
export const e = () => console.log('resize', window.innerWidth)
export const f = ref.current.clientWidth < 400
export const g = window.innerWidth < limit
export const h = window.innerHeight < 768
const innerWidth = width - 40
export const i = innerWidth < 120
const REDUCED = '(prefers-reduced-motion: reduce)'
const LIMIT = 120
const unused = '(max-width: 767px)'
export const j = useMediaQuery(REDUCED)
export const k = ref.current.clientWidth < LIMIT
export const l = window.innerHeight < LIMIT
export const m = useMediaQuery(other)
