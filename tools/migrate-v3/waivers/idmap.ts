import type { GuardKind } from '../../../packages/basalt-ui/src/guard/types.ts'

/**
 * One 2.x waiver id and where it lands in v3, per lane. A lane left out has no v3 twin and the site
 * goes to the worklist: a waiver is never rewritten to an id that does not stand for the same law.
 * `ts` ids are oxlint rules (`basalt/<id>` unless already namespaced); `css` ids are stylelint rules.
 */
export type IdTarget = { readonly ts?: string; readonly css?: string; readonly retired?: true }

/** Exhaustive over the 2.x guard kinds (`GuardKind`): a new kind is a type error here. */
const GUARD_KINDS = {
  'raw-hex': { ts: 'colour-literal', css: 'color-no-hex' },
  'raw-color-fn': { ts: 'colour-literal', css: 'function-disallowed-list' },
  'localstorage-theme': {},
  'off-identity-accent': {},
  'mantine-shade-index': {},
  'raw-spacing': { css: 'declaration-property-value-disallowed-list' },
  'raw-radius': { css: 'declaration-property-value-disallowed-list' },
  'raw-surface': {
    ts: 'shadcn/no-inline-styles',
    css: 'declaration-property-value-disallowed-list',
  },
  'card-with-border': {},
  'off-system-surface-var': {},
  'raw-html-layout': {},
  'inline-spacing': { ts: 'shadcn/no-inline-styles' },
  'inline-display': { ts: 'shadcn/no-inline-styles' },
  'raw-motion-value': {},
  'raw-form-control': { ts: 'primitive-bypass' },
  'sub-16-input-font': { css: 'declaration-property-value-disallowed-list' },
  'raw-font-family': { css: 'declaration-property-value-disallowed-list' },
  'theme-allow-unscoped': {},
  'surface-shadow-override': {},
  'css-raw-surface': { css: 'declaration-property-value-disallowed-list' },
  'inline-font-size': { ts: 'shadcn/no-inline-styles' },
  'hidden-inline-style': { ts: 'shadcn/no-inline-styles' },
  'in-body-page-title': {},
  'raw-selection-control': { ts: 'control-home' },
  'raw-media-query': { ts: 'viewport-keyed', css: 'media-feature-name-disallowed-list' },
  'unknown-vx-token': {},
  'series-palette': {},
} as const satisfies Record<GuardKind, IdTarget>

/** The 2.x oxlint-plugin ids (`PLUGIN_RULE_IDS` in src/guard/index.ts) that are valid in a `theme-allow`. */
const PLUGIN_IDS = {
  'no-raw-font-size': {},
  'raw-size-literal': {},
  'card-inset': {},
  'chart-in-raw-surface': {},
  'hand-rolled-shell': {},
  'shadow-basalt-export': {},
  'raw-scroll-container': { ts: 'raw-scroll' },
  'hand-rolled-filter': {},
  'control-outside-home': { ts: 'control-home' },
  'bound-control-outside-home': { ts: 'control-home' },
  'control-size-literal': {},
  'responsive-twin': {},
  'search-literal-link': { ts: 'router-search' },
  'use-search-from-literal': { ts: 'router-search' },
  'query-fn-unwrap': {},
  'forms-field-key': {},
  'chart-engine-boundary': {},
  'chart-host-single': {},
  'token-layer-boundary': {},
  'no-import-meta-env': {},
  'raw-breakpoint': { ts: 'viewport-keyed' },
  'no-dev-helper': { ts: 'no-dev-helper' },
  'route-view-transition': {},
  'status-fill-as-text': { ts: 'status-fill-as-text' },
  'agent-no-raw-usechat': {},
  'ai-sdk-major': {},
  'unframed-chart': { retired: true },
  'visx-boundary': { retired: true },
  'visx-tooltip': { retired: true },
  'hand-rolled-plot': { retired: true },
  'chart-legend-literal': { retired: true },
  'raw-visx-axis': { retired: true },
  'chart-missing-aria-label': { retired: true },
  'duplicate-notifications-mount': { retired: true },
  'query-dual-import': { retired: true },
  'provider-above-router': { retired: true },
  'page-bar-budget': { retired: true },
  'agent-resume-guard': { retired: true },
  'deprecated-export': { retired: true },
} as const satisfies Record<string, IdTarget>

export const ID_MAP: Readonly<Record<string, IdTarget>> = { ...GUARD_KINDS, ...PLUGIN_IDS }

/** The v3 ids a file-level directive may name, and only on a `manifest.deepRender` path (guardrails 6). */
export const FILE_WAIVABLE: ReadonlySet<string> = new Set([
  'colour-literal',
  'shadcn/no-inline-styles',
  'raw-scroll',
])

export const isKnown2xId = (id: string): boolean => Object.hasOwn(ID_MAP, id)

export type Lane = 'ts' | 'css'

export type Resolved =
  | { readonly ok: true; readonly ids: readonly string[] }
  | { readonly ok: false; readonly reason: string }

/** Resolve a site's 2.x ids to v3 ids for one lane; all or nothing, order kept, duplicates folded. */
export function resolveIds(ids: readonly string[], lane: Lane): Resolved {
  const out: string[] = []
  for (const id of ids) {
    const target: IdTarget | undefined = ID_MAP[id]
    if (target === undefined) return { ok: false, reason: `unknown kind \`${id}\`` }
    if (target.retired) return { ok: false, reason: `\`${id}\` is a retired 2.x id, a dead waiver` }
    const v3 = target[lane]
    if (v3 === undefined) return { ok: false, reason: `\`${id}\` has no v3 ${lane} id` }
    if (!out.includes(v3)) out.push(v3)
  }
  return { ok: true, ids: out }
}

/** The id as the directive spells it: oxlint ids are `basalt/<id>` unless already namespaced. */
export const directiveId = (id: string, lane: Lane): string =>
  lane === 'ts' && !id.includes('/') ? `basalt/${id}` : id
