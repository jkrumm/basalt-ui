import { createRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { routeTree } from './route-tree.gen'

/**
 * The fixture router. Not registered (`declare module … Register` is program-global and would
 * retype every Link in the package): the type checks pass this router's type explicitly.
 */
export const makeRouter = (history: RouterHistory) => createRouter({ routeTree, history })

export type FixtureRouter = ReturnType<typeof makeRouter>
