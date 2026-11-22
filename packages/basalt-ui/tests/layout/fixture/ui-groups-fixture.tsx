/**
 * The `ui-groups` fixture (bench-control-groups): every control at every size side by side, and the
 * three groups in each orientation, with `fill` and with a child that opts out. No shell and no
 * provider. The harness is told to "mount" it by a no-op `window.basaltMountFixture`, since the page
 * renders itself on load.
 *
 * Probes, each a `data-testid`:
 * - `row-md`, `row-sm`: each control alone at that size; `group-sm`: the same controls in a
 *   `ControlGroup size="sm"` with no size of their own;
 * - `bg-h`, `bg-v`: a three-button `ButtonGroup`, horizontal and vertical; `bg-fill`: filled
 *   in a 384 px box, its last button `grow-0`; `bg-optout`: `size="sm"` with one `md` button;
 * - `cg`, `cg-fill`, `cg-v`: a `ControlGroup` of a select, an input and a button;
 * - `ig`: an `InputGroup` of an addon, an input and a native select;
 * - `legacy` and `pagebar`: PageBar's former private group and the `ButtonGroup` that replaced it,
 *   with the same three buttons.
 */
import type { ReactElement, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '../../../src/ui/button'
import { CopyButton } from '../../../src/ui/copy-button'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from '../../../src/ui/combobox'
import { ButtonGroup, ControlGroup, InputAddon, InputGroup } from '../../../src/ui/control-group'
import { DatePicker } from '../../../src/ui/date-picker'
import { Input } from '../../../src/ui/input'
import { PasswordInput } from '../../../src/ui/password-input'
import { NumberField } from '../../../src/ui/number-field'
import { Segmented } from '../../../src/ui/segmented'
import { NativeSelect, Select } from '../../../src/ui/select'

type Size = 'md' | 'sm'

const FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'owner', label: 'Owner' },
]
const TEAMS = ['payments', 'search']

function Glyph({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={className ?? 'size-icon'} fill="none" aria-hidden="true">
      <path d="M4 8h8M8 4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Every control once; `size` undefined leaves it to the enclosing group. */
function Controls({ size, tag }: { size: Size | undefined; tag: string }): ReactElement {
  return (
    <>
      <Button size={size}>Save</Button>
      <Button size={size} shape="icon" aria-label={`Add ${tag}`}>
        <Glyph />
      </Button>
      <CopyButton size={size} value="sk-123" variant="secondary" showLabel />
      <Input size={size} aria-label={`Name ${tag}`} placeholder="Name" />
      <Input size={size} aria-label={`Search ${tag}`} start={Glyph} />
      <PasswordInput size={size} aria-label={`Password ${tag}`} autoComplete="new-password" />
      <NativeSelect size={size} aria-label={`Field ${tag}`} options={FIELDS} />
      <Select size={size} aria-label={`Stage ${tag}`} options={FIELDS} placeholder="Stage" />
      <Combobox items={TEAMS}>
        <ComboboxInput size={size} aria-label={`Team ${tag}`} placeholder="Team" />
        <ComboboxContent empty="No team">
          {(team: string) => (
            <ComboboxItem key={team} value={team}>
              {team}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>
      <NumberField size={size} aria-label={`Replicas ${tag}`} defaultValue={3} />
      <DatePicker size={size} aria-label={`Due ${tag}`} />
      <Segmented size={size} aria-label={`Range ${tag}`} options={FIELDS} defaultValue="name" />
      <InputGroup size={size}>
        <InputAddon>https://</InputAddon>
        <Input aria-label={`Website ${tag}, without https://`} />
      </InputGroup>
    </>
  )
}

function Three({ last }: { last?: string }): ReactElement {
  return (
    <>
      <Button shape="icon" aria-label="Previous">
        <Glyph />
      </Button>
      <Button>Today</Button>
      <Button {...(last !== undefined && { className: last })}>Next week</Button>
    </>
  )
}

function Labelled({ id, children }: { id: string; children: ReactNode }): ReactElement {
  return (
    <section data-testid={id} className="flex flex-col items-start gap-2">
      {children}
    </section>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <h1 className="text-sm">Control vocabulary</h1>
      <div data-testid="row-md" className="flex flex-wrap items-center gap-2">
        <Controls size="md" tag="md" />
      </div>
      <div data-testid="row-sm" className="flex flex-wrap items-center gap-2">
        <Controls size="sm" tag="sm" />
      </div>
      <div data-testid="group-sm" className="flex flex-wrap">
        <ControlGroup size="sm" aria-label="Every control, small" className="flex-wrap">
          <Controls size={undefined} tag="grouped" />
        </ControlGroup>
      </div>
      <Labelled id="bg-h">
        <ButtonGroup aria-label="Period">
          <Three />
        </ButtonGroup>
      </Labelled>
      <Labelled id="bg-v">
        <ButtonGroup aria-label="Period, stacked" orientation="vertical">
          <Three />
        </ButtonGroup>
      </Labelled>
      <Labelled id="bg-fill">
        <div className="w-96">
          <ButtonGroup aria-label="Period, filled" fill>
            <Three last="grow-0" />
          </ButtonGroup>
        </div>
      </Labelled>
      <Labelled id="bg-optout">
        <ButtonGroup aria-label="Small with one regular" size="sm">
          <Button>Small</Button>
          <Button size="md">Regular</Button>
        </ButtonGroup>
      </Labelled>
      <Labelled id="cg">
        <ControlGroup aria-label="Find">
          <NativeSelect aria-label="Field" options={FIELDS} />
          <Input aria-label="Query" placeholder="Find filters" />
          <Button shape="icon" aria-label="Search">
            <Glyph />
          </Button>
        </ControlGroup>
      </Labelled>
      <Labelled id="cg-fill">
        <div className="w-96">
          <ControlGroup aria-label="Find, filled" fill>
            <NativeSelect aria-label="Field, filled" options={FIELDS} className="grow-0" />
            <Input aria-label="Query, filled" placeholder="Find filters" />
            <Button>Search</Button>
          </ControlGroup>
        </div>
      </Labelled>
      <Labelled id="cg-v">
        <ControlGroup aria-label="Find, stacked" orientation="vertical">
          <NativeSelect aria-label="Field, stacked" options={FIELDS} />
          <Input aria-label="Query, stacked" placeholder="Find filters" />
          <Button>Search</Button>
        </ControlGroup>
      </Labelled>
      <Labelled id="ig">
        <div className="w-96">
          <InputGroup aria-label="Price">
            <InputAddon>EUR</InputAddon>
            <Input aria-label="Price in EUR" inputMode="decimal" autoComplete="off" />
            <NativeSelect aria-label="Per" options={FIELDS} />
          </InputGroup>
        </div>
      </Labelled>
      <Labelled id="legacy">
        <fieldset className="m-0 inline-flex min-w-0 items-center border-0 p-0 [&>*:not(:first-child)]:-ms-px [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none">
          <Button variant="primary">Prev</Button>
          <Button>Today</Button>
          <Button>Next</Button>
        </fieldset>
      </Labelled>
      <Labelled id="pagebar">
        <ButtonGroup className="min-w-0">
          <Button variant="primary">Prev</Button>
          <Button>Today</Button>
          <Button>Next</Button>
        </ButtonGroup>
      </Labelled>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
