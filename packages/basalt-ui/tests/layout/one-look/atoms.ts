/**
 * The five atoms a static page and a bridge (Tailwind) page must read identically: surface roles,
 * the ink ramp, the type ladder, radii, and ring plus shadow.
 *
 * One row = one probe element. The tokens page paints it with plain `var(--vx-*)` declarations (what
 * a hand-written stylesheet does); the bridge page paints it with the utility the bridge defines for
 * that role. Chrome then resolves both and the suite compares the computed properties, so a bridge
 * mapping that drifts from the token table, or a token a utility reads wrongly, shows as a diff.
 */

export type AtomGroup = 'surface' | 'ink' | 'type' | 'radius' | 'shadow' | 'ring'

export interface Atom {
  readonly id: string
  readonly group: AtomGroup
  /** Declarations for the tokens page's `#id` rule. */
  readonly declarations: string
  /** Utilities on the bridge page's element. */
  readonly utilities: string
  /** The computed properties compared (camelCase, as `getComputedStyle` exposes them). */
  readonly props: readonly string[]
  readonly tag?: 'div' | 'button'
}

const surface = (name: string, token: string, utility: string): Atom => ({
  id: `surface-${name}`,
  group: 'surface',
  declarations: `background-color: var(--vx-${token});`,
  utilities: utility,
  props: ['backgroundColor'],
})

const ink = (name: string, token: string, utility: string): Atom => ({
  id: `ink-${name}`,
  group: 'ink',
  declarations: `color: var(--vx-${token});`,
  utilities: utility,
  props: ['color'],
})

const RUNGS = ['micro', 'xs', 'sm', 'md', 'base', 'lg', 'display'] as const
const rung = (name: (typeof RUNGS)[number]): Atom => ({
  id: `type-${name}`,
  group: 'type',
  declarations: `font-size: var(--vx-text-${name}); line-height: var(--vx-text-${name}-lh);`,
  utilities: `text-${name}`,
  props: ['fontSize', 'lineHeight'],
})

const radius = (name: string): Atom => ({
  id: `radius-${name}`,
  group: 'radius',
  declarations: `border-radius: var(--vx-radius-${name});`,
  utilities: `rounded-${name}`,
  props: ['borderTopLeftRadius', 'borderBottomRightRadius'],
})

const shadow = (name: string): Atom => ({
  id: `shadow-${name}`,
  group: 'shadow',
  declarations: `box-shadow: var(--vx-shadow-${name});`,
  utilities: `shadow-${name}`,
  props: ['boxShadow'],
})

export const ATOMS: readonly (Atom & {
  readonly tokensMarkup: string
  readonly bridgeMarkup: string
})[] = (
  [
    surface('canvas', 'canvas', 'bg-background'),
    surface('card', 'card', 'bg-card'),
    surface('inset', 'inset', 'bg-inset'),
    surface('raised', 'raised', 'bg-popover'),
    ink('ink', 'ink', 'text-foreground'),
    ink('muted', 'ink-muted', 'text-muted-foreground'),
    ink('faint', 'ink-faint', 'text-faint'),
    ink('brand', 'brand', 'text-brand'),
    ...RUNGS.map(rung),
    radius('card'),
    radius('inset'),
    radius('ctrl'),
    radius('chip'),
    shadow('card'),
    shadow('raised'),
    shadow('overlay'),
    {
      // The ring: a bare button gets it from typography.css on the tokens page and from the
      // `focus-ring` utility on the bridge page. Focused with Tab in the test.
      id: 'ring',
      group: 'ring',
      declarations: '',
      utilities: 'focus-ring',
      props: ['outlineStyle', 'outlineWidth', 'outlineOffset', 'outlineColor'],
      tag: 'button',
    },
  ] satisfies readonly Atom[]
).map((atom) => {
  const tag = atom.tag ?? 'div'
  return {
    ...atom,
    tokensMarkup: `<${tag} id="${atom.id}" data-atom>Atom</${tag}>`,
    bridgeMarkup: `<${tag} id="${atom.id}" data-atom class="${atom.utilities}">Atom</${tag}>`,
  }
})

/** The tokens page's probe rules: `#id { declarations }`, one per atom that declares any. */
export function atomRules(): string {
  return ATOMS.filter((a) => a.declarations)
    .map((a) => `#${a.id} { ${a.declarations} }`)
    .join('\n')
}
