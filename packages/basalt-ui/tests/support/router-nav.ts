/**
 * Test-only `defineNav` and `navTarget` for suites that run WITHOUT the `Register` augmentation:
 * the shipped functions reject such a call at compile time, and these suites exercise runtime
 * behaviour only. The strict signatures are proven in `nav.type-guard*.test.ts(x)`, which register a
 * router. The `defineNav` result carries the same type-only brand the shipped one returns, so
 * `AppShell nav` takes it.
 */
import type { NavTarget } from '../../src/core/ports'
import { navTarget as strictNavTarget } from '../../src/router/nav-target'
import { defineNav as strictDefineNav } from '../../src/router/nav/define-nav'
import type { DefinedNav } from '../../src/router/nav/types'

export const defineNav = strictDefineNav as unknown as <const C>(config: C) => C & DefinedNav

export const navTarget = strictNavTarget as unknown as (options: object) => NavTarget
