import { Popover as BasePopover } from '@base-ui/react/popover'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { base } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'
import { POPUP_POSITIONER, POPUP_POSITIONER_CLASS } from '../core/popup-position'
import { popoverContentVariants } from './popover'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const infoHintParts = ['info-hint'] as const

/** The layout-only `className` every hint takes. */
type Layout = {
  /** Layout only (`-my-0.5`). Size, display and stacking belong to the part. */
  className?: string
}

export type InfoHintProps = Layout & {
  /** The popover's title and the glyph's name (`What <label> means`): the word being explained. */
  label: string
  /** The explanation. One or two sentences. */
  children: ReactNode
}

/** The words a glossary defines: a record of term to definition, e.g. a generated `as const` object. */
export type GlossaryEntries = Readonly<Record<string, string>>

/** The terms of a glossary as a caller types them: the key, or the key with its first letter capitalised. */
export type GlossaryTerm<T extends GlossaryEntries> =
  | Extract<keyof T, string>
  | Capitalize<Extract<keyof T, string>>

export type GlossaryHintProps<T extends GlossaryEntries> = Layout & {
  /** A word the glossary defines, in any of the two typed capitalisations; a word it does not define is a type error. */
  term: GlossaryTerm<T>
}

/** What `defineGlossary` returns: the hint bound to its entries. */
export type Glossary<T extends GlossaryEntries> = {
  InfoHint: (props: GlossaryHintProps<T>) => ReactElement
}

const capitalise = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`

function Hint({
  title,
  children,
  className,
}: Layout & { title: string; children: ReactNode }): ReactElement {
  const t = useMessages(base)
  return (
    <BasePopover.Root>
      <BasePopover.Trigger
        openOnHover
        delay={150}
        aria-label={t('base.infoHint.label', title)}
        data-slot="info-hint"
        className={cn(
          'relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring data-popup-open:text-foreground after:absolute after:inset-0 pointer-coarse:after:-inset-2.5',
          className,
        )}
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7.25v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </svg>
      </BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner
          {...POPUP_POSITIONER}
          sideOffset={6}
          className={POPUP_POSITIONER_CLASS}
        >
          <BasePopover.Popup
            className={cn(
              popoverContentVariants(),
              'w-max max-w-[min(20rem,var(--available-width))]',
            )}
          >
            <BasePopover.Title className="text-sm font-semibold text-foreground">
              {title}
            </BasePopover.Title>
            <BasePopover.Description className="mt-1 text-sm text-muted-foreground">
              {children}
            </BasePopover.Description>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}

/**
 * A small info glyph beside a word or number, with its definition in a popover: it opens on hover
 * after 150 ms, on Enter or Space when focused and on a press (touch), and closes on Escape, an
 * outside press or blur. The glyph is named `What <label> means`. For a word a glossary defines,
 * use the `InfoHint` that `defineGlossary` returns: its text is never retyped.
 *
 * The glossary contract: one source file the app owns (its docs' definitions) is turned by an
 * app-side script into an `as const` object of term to definition, committed as generated code;
 * `defineGlossary(GLOSSARY)` binds it, so a word that is not in the source is a type error and a
 * definition cannot drift from the docs. A test that regenerates the file and compares it with the
 * committed one holds the drift. Terms are lower case, a multi-word term is one key (`'held signal'`),
 * the popover title is the term with a capital first letter, and a definition is one or two plain sentences.
 *
 * @useWhen one word or number in a header, a sentence, a toolbar or a label needs its definition one press away
 * @neverWhen the word is in a glossary (use the `InfoHint` from `defineGlossary`), or the definition is the card's own (use `info` on the card)
 *
 * @example
 * <span>Net revenue <InfoHint label="Net revenue">Revenue after refunds, per calendar month.</InfoHint></span>
 */
export function InfoHint({ label, children, className }: InfoHintProps): ReactElement {
  return (
    <Hint title={label} {...(className !== undefined && { className })}>
      {children}
    </Hint>
  )
}

/**
 * Declares the app's glossary and returns the `InfoHint` bound to it, so a word is a typed key and
 * its definition is read from one source, never retyped. Throws here, at define time, on an empty
 * definition or on two terms that differ only in case, naming them. The entries are usually an
 * `as const` object generated from the app's docs (the contract is on `InfoHint`).
 *
 * @example
 * export const { InfoHint } = defineGlossary({ errand: 'A step only a person can do.' })
 * // <InfoHint term="Errand" />   // <InfoHint term="Errnd" /> fails to compile
 */
export function defineGlossary<const T extends GlossaryEntries>(entries: T): Glossary<T> {
  const byTerm = new Map<string, { term: string; definition: string }>()
  for (const [term, definition] of Object.entries(entries)) {
    const key = term.toLowerCase()
    if (definition.trim() === '')
      throw new Error(`defineGlossary: "${term}" has an empty definition`)
    const clash = byTerm.get(key)
    if (clash !== undefined)
      throw new Error(`defineGlossary: "${clash.term}" and "${term}" are one term`)
    byTerm.set(key, { term, definition })
  }
  function BoundInfoHint({ term, className }: GlossaryHintProps<T>): ReactElement {
    return (
      <Hint title={capitalise(term)} {...(className !== undefined && { className })}>
        {byTerm.get(term.toLowerCase())?.definition}
      </Hint>
    )
  }
  return { InfoHint: BoundInfoHint }
}
