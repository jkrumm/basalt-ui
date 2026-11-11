// The value tables of the layout codemod. Sources: docs/v3/concepts/migration-release.md section 7
// (trap table) and gap-migration 2.1 (Stack/Group/SimpleGrid defaults read from the Mantine layers).

/** Tags the codemod converts. */
export const TARGETS = new Set(['Stack', 'Group', 'Flex', 'Center', 'Box', 'Text', 'SimpleGrid'])

/** Responsive keys Mantine accepts. */
export const BREAKPOINTS = ['base', 'xs', 'sm', 'md', 'lg', 'xl']

/**
 * Mantine breakpoint to the v3 variant prefix. The values 840 / 1200 are now named md / xl; a
 * name that kept its value would emit a dead class under the reset, so only these two map.
 */
export const BREAKPOINT_PREFIX: Record<string, string> = { base: '', sm: 'md:', lg: 'xl:' }

/** Spacing tokens in 4px units: xs..xl = 8 / 12 / 16 / 20 / 24 px. */
export const SPACING: Record<string, number> = { xs: 2, sm: 3, md: 4, lg: 5, xl: 6 }

/**
 * Type sizes map by px, not by name: Mantine md 15 is v3 `md`, Mantine lg 16 is v3 `base`, Mantine
 * xl 18 is v3 `lg`. The name-for-name table was the trap that made 128 elements silently wrong.
 */
export const FONT_SIZE: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-base',
  xl: 'text-lg',
}

export const RADIUS: Record<string, string> = {
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
}

export const ALIGN: Record<string, string> = {
  'flex-start': 'start',
  start: 'start',
  'flex-end': 'end',
  end: 'end',
  center: 'center',
  stretch: 'stretch',
  baseline: 'baseline',
}

export const JUSTIFY: Record<string, string> = {
  'flex-start': 'start',
  start: 'start',
  'flex-end': 'end',
  end: 'end',
  center: 'center',
  'space-between': 'between',
  'space-around': 'around',
  'space-evenly': 'evenly',
  stretch: 'stretch',
}

export const FONT_WEIGHT: Record<string, string> = {
  '100': 'font-thin',
  '200': 'font-extralight',
  '300': 'font-light',
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black',
  bold: 'font-bold',
  normal: 'font-normal',
}

/** Names people expect to be weights; none is a CSS value, so Mantine never applied them. */
export const LATENT_WEIGHT_NAMES = new Set([
  'thin',
  'extralight',
  'light',
  'medium',
  'semibold',
  'extrabold',
  'black',
])

/** Mantine style props that map to a class on a target and cannot be applied to a composite. */
export const STYLE_PROPS = new Set([
  'm',
  'mt',
  'mb',
  'ml',
  'mr',
  'mx',
  'my',
  'ms',
  'me',
  'p',
  'pt',
  'pb',
  'pl',
  'pr',
  'px',
  'py',
  'ps',
  'pe',
  'w',
  'h',
  'miw',
  'maw',
  'mih',
  'mah',
  'fw',
  'fz',
  'c',
  'bg',
  'ta',
  'tt',
  'td',
  'fs',
  'ff',
  'lh',
  'lts',
  'pos',
  'display',
  'inset',
  'top',
  'left',
  'right',
  'bottom',
  'flex',
  'bdrs',
  'opacity',
])

/** Props that pass through to the replacement element untouched. */
export function isPassThrough(name: string): boolean {
  return (
    name === 'key' ||
    name === 'ref' ||
    name === 'id' ||
    name === 'className' ||
    name === 'style' ||
    name === 'children' ||
    name === 'role' ||
    name === 'title' ||
    name === 'tabIndex' ||
    name.startsWith('data-') ||
    name.startsWith('aria-') ||
    /^on[A-Z]/.test(name)
  )
}

/** Props a target accepts beyond the shared style props. */
export const LAYOUT_PROPS: Record<string, Set<string>> = {
  Stack: new Set(['gap', 'align', 'justify']),
  Group: new Set(['gap', 'align', 'justify', 'wrap']),
  Flex: new Set(['gap', 'rowGap', 'columnGap', 'align', 'justify', 'wrap', 'direction']),
  Center: new Set(),
  Box: new Set(),
  Text: new Set(['size']),
  SimpleGrid: new Set(['cols', 'spacing', 'verticalSpacing']),
}

/** Always-emitted classes per tag. Text's font-normal is added in convert.ts (an explicit fw replaces it). */
export const BASE_CLASSES: Record<string, string[]> = {
  Stack: ['flex', 'flex-col'],
  Group: ['flex'],
  Flex: ['flex'],
  Center: ['flex', 'items-center', 'justify-center'],
  Box: [],
  Text: [],
  SimpleGrid: ['grid'],
}

/** Mantine's own defaults, always emitted explicitly (read from Stack/Group/SimpleGrid.layer.css). */
export const DEFAULTS: Record<string, Record<string, string | number>> = {
  Stack: { gap: 'md' },
  Group: { gap: 'md', align: 'center', wrap: 'wrap' },
  Flex: {},
  Center: {},
  Box: {},
  Text: { size: 'md' },
  SimpleGrid: { cols: 1, spacing: 'md' },
}
