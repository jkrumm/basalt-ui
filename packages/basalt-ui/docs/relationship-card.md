---
name: RelationshipCard
use when: 'a record page lists the records it is linked to (suppliers, signers, people who know this one) and each needs a face, how it relates and a few figures'
never when: 'the linked records are compared by columns (use a table) or are only names (use EntityChip)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [relationship-card, relationship-facts, relationship-link, relationship-relation, relationship-strength]
---

# RelationshipCard

A linked record as a card: its face and name, a relation or a strength, two or three facts, and one
link over the whole card to the record. In a section of related records the cards lay out on
`CardGrid`. The link is a plain `href`, so a click opens the record in the surface the app's peek
gives it and a middle click or a copy still has an address.

## Signature

```ts
RelationshipCard({ title, subtitle, avatar, href, linkLabel, facts, relation, strength, }: RelationshipCardProps): ReactElement
  // either relation or strength
  title: string  // The linked record's name
  subtitle?: string  // One muted line under the name: a type, a domain
  avatar?: EntityAvatar  // The record's face; `{}` draws its initials
  href: string | NavTarget  // The record's page
  linkLabel?: string  // Names the link for assistive technology
  facts?: RelationshipFacts
  relation?: string  // What the linked record is to this one: `Signer`, `Sole source`
  strength?: RelationshipStrength  // How close the link is, instead of a relation
```

## Example

```tsx
<CardGrid min="narrow">
  <RelationshipCard
    title="Hex bolt M8"
    avatar={{ shape: 'object' }}
    relation="Fasteners"
    facts={[{ label: 'On hand', value: '1,200' }, { label: 'Next delivery', value: 'Dec 4' }]}
    href="/parts/m8-bolt"
  />
</CardGrid>
```
