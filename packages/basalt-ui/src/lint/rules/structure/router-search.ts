/**
 * `basalt/router-search` (guardrails section 4, row 11): registered ahead of its body. The three
 * forms (literal `search=` on `Link`, `loaderDeps` returning the whole search, an impure inline
 * `validateSearch`) are built by v3-ctl-8; until then the id is in the table with no form, so the
 * coverage block prints `not guarded:` and the rule reports nothing.
 */
import { defineRules } from '../../rule-table'

export const routerSearchRules = defineRules({
  'router-search': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'argo strength-tracker.tsx:53 re-runs the loader on every search param; literal search hits traps reproduced on Router 1.170.46',
    forms: [],
  },
})
