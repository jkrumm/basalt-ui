// fallow-ignore-file unused-file
/**
 * The extras export.
 *
 * @useWhen the fixture needs a second subpath
 * @neverWhen never
 */
export const EXTRAS = { a: 1, b: 2 } as const

export { createCounter } from '../index'

/**
 * A numeric limit.
 *
 * @useWhen a caller needs the cap
 * @neverWhen the cap is configurable
 */
export const LIMIT = 8
