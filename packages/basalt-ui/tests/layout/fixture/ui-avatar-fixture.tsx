/**
 * The `ui-avatar` fixture: every size and shape with each fallback and a real image, a failing image
 * beside its plain twin, a stack with an overflow, an entity title in a narrow box, and a chip with
 * a link and a remove button. No shell and no provider. Probes carry a `data-testid`.
 */
import { createRoot } from 'react-dom/client'
import { Avatar, AvatarStack } from '../../../src/ui/avatar'
import { EntityChip, EntityTitle } from '../../../src/ui/entity'

const PICTURE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='gray'/></svg>"

function Building({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
      <path d="M3 14V3h7v11M10 7h3v7M6 6h1M6 9h1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const SIZES = ['xs', 'sm', 'md', 'lg'] as const
const PEOPLE = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Edsger Dijkstra',
  'Barbara Liskov',
  'Donald Knuth',
].map((name) => ({ name }))

function Fixture() {
  return (
    <main className="flex flex-col gap-4 bg-surface p-4 text-sm text-foreground">
      {SIZES.map((size) => (
        <div key={size} data-testid={`size-${size}`} className="flex items-center gap-3">
          <Avatar name="Ada Lovelace" size={size} />
          <Avatar name="Acme" size={size} shape="object" icon={Building} />
          <Avatar name="Acme Labs" size={size} shape="object" src={PICTURE} />
          <Avatar name="Grace Hopper" size={size} src={PICTURE} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span data-testid="plain">
          <Avatar name="Ada Lovelace" />
        </span>
        <span data-testid="broken">
          <Avatar name="Ada Lovelace" src="/missing-avatar.png" />
        </span>
      </div>
      <div data-testid="stack" className="flex items-center gap-3">
        <AvatarStack label="Assignees" people={PEOPLE} />
      </div>
      <div data-testid="title-narrow" className="w-48">
        <EntityTitle
          title="A very long company name that has to truncate"
          subtitle="a-very-long-domain-name.example.com"
          avatar={{ shape: 'object' }}
          tags={<span className="rounded-chip bg-selected px-1 text-xs">Lead</span>}
          size="lg"
        />
      </div>
      <div data-testid="title-heading">
        <EntityTitle
          level={1}
          title="Acme"
          subtitle="acme.com"
          avatar={{ icon: Building, shape: 'object' }}
          size="lg"
        />
      </div>
      <div className="flex items-center gap-3">
        <span data-testid="chip">
          <EntityChip
            label="Acme"
            href="/companies/acme"
            avatar={{ shape: 'object' }}
            onRemove={() => undefined}
          />
        </span>
        <span data-testid="chip-plain">
          <EntityChip label="Ada Lovelace" avatar={{}} />
        </span>
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
