/**
 * The RuleTester suites of `motion-literal`, built from its two fixtures by `suiteFor`: ESLint runs
 * them in `motion-literal.test.ts`, oxlint's `plugins-dev` runs a bundled copy under Node.
 */
import type { Suite } from './colour-literal.cases'
import { suiteFor } from './colour-literal.cases'
import { motionLiteralRules } from './motion-literal'

export const SUITES: Suite[] = [suiteFor(motionLiteralRules, 'motion-literal')]
