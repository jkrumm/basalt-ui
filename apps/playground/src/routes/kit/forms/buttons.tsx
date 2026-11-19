import { createFileRoute } from '@tanstack/react-router'
import { Page, Section } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from 'basalt-ui/ui/menu'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Arrow, Chevron, Download, More, Plus, Trash, later } from './-specimen'

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const
const LABEL = {
  primary: 'Deploy',
  secondary: 'Preview',
  ghost: 'Cancel',
  danger: 'Delete',
} as const
const SIZES = [
  { size: 'md', label: 'Medium' },
  { size: 'sm', label: 'Small' },
] as const

/** A captioned row of buttons; the caption names what the row varies. */
function Row({ caption, children }: { caption: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-xs text-muted-foreground">{caption}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Stack({ children }: { children: ReactNode }): ReactElement {
  return <div className="flex flex-col gap-6">{children}</div>
}

/** A save that takes a second: the button holds focus and reads busy while it runs. */
function LiveLoading(): ReactElement {
  const [saving, setSaving] = useState(false)
  return (
    <Button
      variant="primary"
      loading={saving}
      onClick={() => {
        setSaving(true)
        void later(1500).then(() => {
          setSaving(false)
        })
      }}
    >
      {saving ? 'Saving' : 'Save, then wait'}
    </Button>
  )
}

/**
 * Buttons: four variants in two sizes, an icon before or after the label or alone, disabled and
 * loading, and the menu button the kit composes from `Menu` and `Button`. No split button ships
 * (docs/v3/verdicts/showcase-gaps.md, Forms).
 */
function ButtonsRoute(): ReactElement {
  return (
    <Page area="kit-forms-buttons">
      <Section
        title="Variants and sizes"
        summary="One primary per surface; danger for what cannot be undone."
      >
        <Stack>
          {SIZES.map(({ size, label }) => (
            <Row key={size} caption={label}>
              {VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {LABEL[variant]}
                </Button>
              ))}
            </Row>
          ))}
        </Stack>
      </Section>
      <Section title="Icons" summary="Before the label for the verb, after it for where it goes.">
        <Stack>
          <Row caption="Icon before the label">
            <Button variant="primary">
              <Plus />
              New service
            </Button>
            <Button>
              <Download />
              Export
            </Button>
            <Button variant="danger">
              <Trash />
              Delete
            </Button>
            <Button size="sm">
              <Plus />
              Add row
            </Button>
          </Row>
          <Row caption="Icon after the label">
            <Button variant="primary">
              Continue
              <Arrow />
            </Button>
            <Button variant="ghost">
              Open the run
              <Arrow />
            </Button>
            <Button size="sm" variant="ghost">
              Details
              <Arrow />
            </Button>
          </Row>
          <Row caption="Icon alone, named by aria-label">
            {VARIANTS.map((variant) => (
              <Button
                key={variant}
                variant={variant}
                shape="icon"
                aria-label={`${LABEL[variant]} (icon)`}
              >
                {variant === 'danger' ? <Trash /> : <Plus />}
              </Button>
            ))}
          </Row>
        </Stack>
      </Section>
      <Section
        title="Disabled and loading"
        summary="Loading keeps focus on the button and reads busy."
      >
        <Stack>
          <Row caption="Disabled">
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} disabled>
                {LABEL[variant]}
              </Button>
            ))}
          </Row>
          <Row caption="Loading">
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} loading>
                {LABEL[variant]}
              </Button>
            ))}
          </Row>
          <Row caption="Live: click to run a one-second save">
            <LiveLoading />
          </Row>
        </Stack>
      </Section>
      <Section title="Menu button" summary="A Button as the trigger of a Menu.">
        <Row caption="Labelled, and icon only">
          <Menu>
            <MenuTrigger render={<Button />}>
              Actions
              <Chevron />
            </MenuTrigger>
            <MenuContent>
              <MenuItem>Redeploy</MenuItem>
              <MenuItem>Roll back</MenuItem>
              <MenuSeparator />
              <MenuItem>Delete service</MenuItem>
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger render={<Button variant="ghost" shape="icon" aria-label="More actions" />}>
              <More />
            </MenuTrigger>
            <MenuContent>
              <MenuItem>Copy the id</MenuItem>
              <MenuItem>Open the logs</MenuItem>
            </MenuContent>
          </Menu>
        </Row>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/buttons')({
  staticData: { title: 'Buttons' },
  component: ButtonsRoute,
})
