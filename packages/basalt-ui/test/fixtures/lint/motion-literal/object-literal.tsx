// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).

// @invalid
export const a = <Motion.div transition={{ duration: 0.3 }} />

// @invalid
export const b = <Motion.div animate={{ x: 1, transition: { delay: 0.1 } }} />

// @invalid
export const c = <Motion.div transition={{ type: 'spring', bounce: 0.2 }} />

// @invalid
export const d = <Motion.div transition={{ ease: [0.2, 0, 0, 1] }} />

// @invalid
export const e = <Motion.div transition={{ ease: 'easeOut' }} />

// @invalid
animate(el, { opacity: 1 }, { duration: 0.3 })

// @valid
export const f = <Motion.div transition={{ duration: MOTION_DURATION.base }} />

// @valid
export const g = <Motion.div transition={{ duration: 0, ease: MOTION_EASE_ENTER }} />

// @valid
export const h = <Motion.div animate={{ x: 1 }} transition={MOTION_SPRING.standard} />

// @valid
animate(el, { opacity: 1 }, { duration: staggerDelay(i), ease: MOTION_EASE_EXIT })
