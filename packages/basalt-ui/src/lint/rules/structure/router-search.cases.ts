/**
 * The RuleTester suites of `router-search`: the grammar and the builder of `colour-literal.cases.ts`,
 * whose `// @ts` blocks (a cast needs a TS parser) run under oxlint's tester only.
 */
import type { Suite } from './colour-literal.cases'
import { suiteFor } from './colour-literal.cases'
import { routerSearchRules } from './router-search'

export const SUITES: Suite[] = [suiteFor(routerSearchRules, 'router-search')]
