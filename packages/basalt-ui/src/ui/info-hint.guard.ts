import type { GlossaryHintProps, InfoHintProps } from './info-hint'

/**
 * Hand-authored guard for `info-hint` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The module has no cva axes: the guard pins the two props a caller
 * binds (a word and its explanation) and the glossary's typed term.
 */

// basalt:guard requires
type Called = { label: string; children: string }
type CalledTerm = { term: 'errand' }

export const requires = (c: Called): Pick<InfoHintProps, 'label' | 'children'> => c
export const requiresTerm = (c: CalledTerm): Pick<GlossaryHintProps<{ errand: string }>, 'term'> =>
  c

// basalt:guard closed
// @ts-expect-error a hint without its word is a type error
export const unlabelled: InfoHintProps = { children: 'Revenue after refunds.' }
// @ts-expect-error a term the glossary does not define is a type error
export const unknownTerm: GlossaryHintProps<{ errand: string }> = { term: 'errnd' }
