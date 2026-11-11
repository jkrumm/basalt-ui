/**
 * Test-only `defineNav` for suites that run WITHOUT the `Register` augmentation: the shipped
 * `defineNav` rejects such a call at compile time, and these suites exercise runtime behaviour
 * only. The strict signature is proven in `nav.type-guard.test.ts`, which registers a router.
 */
import { defineNav as strictDefineNav } from '../../src/router/nav/define-nav'

export const defineNav = strictDefineNav as unknown as <const C>(config: C) => C
