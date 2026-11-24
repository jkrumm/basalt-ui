import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import type { NavTarget, Tone } from '../core/ports'
import { Lozenge } from '../ui/badge'
import { Card } from '../ui/card'
import { EntityTitle } from '../ui/entity'
import type { EntityAvatar } from '../ui/entity'

/** One fact of a relationship: a label over a value. */
export type RelationshipFact = {
  label: string
  value: string | number
  /** The value is a time or an id: drawn in the mono face with tabular numerals. */
  mono?: boolean | undefined
}

/** How close the link is: a word in a tone, and the score behind it. */
export type RelationshipStrength = {
  /** The word: `Strong`, `Weak`. Color never carries it alone. */
  label: string
  tone?: Tone
  /** The number behind the word, printed beside it. */
  score?: number
}

/** Two or three facts, or fewer: a card that needs more is a record page. */
export type RelationshipFacts =
  | readonly []
  | readonly [RelationshipFact]
  | readonly [RelationshipFact, RelationshipFact]
  | readonly [RelationshipFact, RelationshipFact, RelationshipFact]

type RelationshipBase = {
  /** The linked record's name. */
  title: string
  /** One muted line under the name: a type, a domain. */
  subtitle?: string
  /** The record's face; `{}` draws its initials. */
  avatar?: EntityAvatar
  /** The record's page. A plain click opens the record surface when the app's `usePeek` declares the kind, else it navigates. */
  href: string | NavTarget
  /** Names the link for assistive technology. Default `Open <title>`. */
  linkLabel?: string
  facts?: RelationshipFacts
}

export type RelationshipCardProps = RelationshipBase &
  (
    | {
        /** What the linked record is to this one: `Signer`, `Sole source`. */
        relation?: string
        strength?: never
      }
    | {
        /** How close the link is, instead of a relation. */
        strength?: RelationshipStrength
        relation?: never
      }
  )

/**
 * A linked record as a card: its face and name, a relation or a strength, two or three facts, and one
 * link over the whole card to the record. In a section of related records the cards lay out on
 * `CardGrid`. The link is a plain `href`, so a click opens the record in the surface the app's peek
 * gives it and a middle click or a copy still has an address.
 *
 * @useWhen a record page lists the records it is linked to (suppliers, signers, people who know this one) and each needs a face, how it relates and a few figures
 * @neverWhen the linked records are compared by columns (use a table) or are only names (use EntityChip)
 *
 * @example
 * <CardGrid min="narrow">
 *   <RelationshipCard
 *     title="Hex bolt M8"
 *     avatar={{ shape: 'object' }}
 *     relation="Fasteners"
 *     facts={[{ label: 'On hand', value: '1,200' }, { label: 'Next delivery', value: 'Dec 4' }]}
 *     href="/parts/m8-bolt"
 *   />
 * </CardGrid>
 */
export function RelationshipCard({
  title,
  subtitle,
  avatar,
  href,
  linkLabel,
  facts = [],
  relation,
  strength,
}: RelationshipCardProps): ReactElement {
  return (
    <div data-slot="relationship-card" className="flex min-w-0 flex-col">
      <Card className="grow group/relation relative gap-3 transition-colors focus-within:bg-accent hover:bg-accent motion-reduce:transition-none">
        <AppLink
          data-slot="relationship-link"
          href={href}
          aria-label={linkLabel ?? `Open ${title}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-card border-0 bg-transparent p-0 focus-ring focus-visible:-outline-offset-2"
        />
        <EntityTitle
          title={title}
          {...(subtitle !== undefined && { subtitle })}
          {...(avatar !== undefined && { avatar })}
          {...(strength !== undefined && {
            tags: (
              <span data-slot="relationship-strength" className="flex items-center gap-1.5">
                <Lozenge tone={strength.tone ?? 'neutral'}>{strength.label}</Lozenge>
                {strength.score !== undefined && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {strength.score}
                  </span>
                )}
              </span>
            ),
          })}
        />
        {relation !== undefined && (
          <p data-slot="relationship-relation" className="m-0 text-xs text-muted-foreground">
            {relation}
          </p>
        )}
        {facts.length > 0 && (
          <dl
            data-slot="relationship-facts"
            className="m-0 grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-x-3 gap-y-1"
          >
            {facts.map((fact) => (
              <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="truncate text-xs text-muted-foreground">{fact.label}</dt>
                <dd
                  className={cn(
                    'm-0 truncate text-sm tabular-nums',
                    fact.mono === true && 'font-mono',
                  )}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  )
}
