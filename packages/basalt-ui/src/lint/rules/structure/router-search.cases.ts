/** The RuleTester suites of `router-search`; the grammar and the builder are `control-home.cases.ts`'s. */
import { suiteFor } from './control-home.cases'
import type { Suite } from './control-home.cases'
import { routerSearchRules } from './router-search'

export const SUITES: Suite[] = [suiteFor(routerSearchRules, 'router-search')]
