/**
 * `basalt/control-home` (guardrails section 4, row 10): registered ahead of its body. The single
 * form (a control primitive outside a home) waits on v3-spike-control-home and is built by
 * v3-ctl-8; until then the id is in the table with no form and reports nothing. It is never
 * file-waivable: each control is a product signal.
 */
import { defineRules } from '../../rule-table'

export const controlHomeRules = defineRules({
  'control-home': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'the highest-friction family, 21 waivers; one console filter existed in 3 UIs (self-guardrails, console)',
    forms: [],
  },
})
