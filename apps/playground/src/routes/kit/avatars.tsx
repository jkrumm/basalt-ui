import { createFileRoute } from '@tanstack/react-router'
import { Page, Section } from 'basalt-ui/page'
import { Avatar, AvatarStack } from 'basalt-ui/ui/avatar'
import { Lozenge } from 'basalt-ui/ui/badge'
import { Card } from 'basalt-ui/ui/card'
import { EntityChip, EntityTitle } from 'basalt-ui/ui/entity'
import { Building2, Users } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

const SIZES = ['xs', 'sm', 'md', 'lg'] as const

/** A one-pixel grey square: a loaded image needs no network on a page that is shot offline. */
const PICTURE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' fill='%23888'/><circle cx='24' cy='19' r='8' fill='%23ccc'/><rect x='10' y='30' width='28' height='18' rx='9' fill='%23ccc'/></svg>"

const PEOPLE = [
  { name: 'Ada Lovelace' },
  { name: 'Alan Turing', src: PICTURE },
  { name: 'Grace Hopper' },
  { name: 'Edsger Dijkstra' },
  { name: 'Barbara Liskov' },
  { name: 'Donald Knuth' },
]

function Row({ caption, children }: { caption: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="w-32 shrink-0 text-xs text-muted-foreground">{caption}</span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

function AvatarsRoute(): ReactElement {
  return (
    <Page area="kit-avatars">
      <Section
        title="Avatar"
        summary="Initials, an icon or an image, in a circle for a person and a rounded square for an object. 16 px in a table cell up to 48 px in a record header."
      >
        <Card>
          <div className="flex flex-col gap-3">
            <Row caption="Person, initials">
              {SIZES.map((size) => (
                <Avatar key={size} name="Ada Lovelace" size={size} />
              ))}
            </Row>
            <Row caption="Person, image">
              {SIZES.map((size) => (
                <Avatar key={size} name="Alan Turing" size={size} src={PICTURE} />
              ))}
            </Row>
            <Row caption="Object, initials">
              {SIZES.map((size) => (
                <Avatar key={size} name="Acme" size={size} shape="object" />
              ))}
            </Row>
            <Row caption="Object, icon">
              {SIZES.map((size) => (
                <Avatar key={size} name="Acme" size={size} shape="object" icon={Building2} />
              ))}
            </Row>
            <Row caption="Tints, from the name">
              {['Ada', 'Alan', 'Grace', 'Edsger', 'Barbara', 'Donald', 'Ken', 'Margaret'].map(
                (name) => (
                  <Avatar key={name} name={name} />
                ),
              )}
            </Row>
            <Row caption="Image fails">
              <Avatar name="Ada Lovelace" src="/missing-avatar.png" size="lg" />
            </Row>
          </div>
        </Card>
      </Section>
      <Section
        title="AvatarStack"
        summary="Overlapping faces ringed in the ground they sit on, with a +N for the rest."
      >
        <Card>
          <div className="flex flex-col gap-3">
            {SIZES.map((size) => (
              <Row key={size} caption={`Size ${size}`}>
                <AvatarStack label="Assignees" people={PEOPLE} size={size} />
                <AvatarStack
                  label="Teams"
                  people={PEOPLE.slice(0, 3)}
                  size={size}
                  shape="object"
                  ground="surface"
                />
              </Row>
            ))}
          </div>
        </Card>
      </Section>
      <Section
        title="EntityTitle"
        summary="A face, a title, a muted line and trailing tags; inline text or a heading, optionally a link."
      >
        <Card>
          <div className="flex flex-col gap-4">
            <EntityTitle
              level={2}
              size="lg"
              title="Acme Industries"
              subtitle="acme.example.com"
              avatar={{ shape: 'object', icon: Building2 }}
              tags={
                <>
                  <Lozenge tone="good">Customer</Lozenge>
                  <Lozenge tone="info">EMEA</Lozenge>
                </>
              }
            />
            <EntityTitle
              size="md"
              title="Ada Lovelace"
              subtitle="Head of Engineering"
              avatar={{ src: PICTURE }}
              href="/overview"
            />
            <EntityTitle size="sm" title="Alan Turing" avatar={{}} />
            <div className="w-56">
              <EntityTitle
                size="md"
                title="A company name too long for its column"
                subtitle="a-very-long-domain-name.example.com"
                avatar={{ shape: 'object' }}
                tags={<Lozenge tone="warn">Lead</Lozenge>}
              />
            </div>
          </div>
        </Card>
      </Section>
      <Section
        title="EntityChip"
        summary="A record as a pill, linked, with a remove button that appears on hover and focus."
      >
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <EntityChip
              label="Acme Industries"
              href="/overview"
              avatar={{ shape: 'object', icon: Building2 }}
              onRemove={() => undefined}
            />
            <EntityChip
              label="Ada Lovelace"
              href="/overview"
              avatar={{}}
              onRemove={() => undefined}
            />
            <EntityChip label="Platform team" avatar={{ shape: 'object', icon: Users }} />
            <EntityChip label="No face" href="/overview" />
          </div>
        </Card>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/avatars')({
  staticData: { title: 'Avatars' },
  component: AvatarsRoute,
})
