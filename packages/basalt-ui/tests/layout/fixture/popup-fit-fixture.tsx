/**
 * The `popup-fit` fixture: every popup the kit ships, one at a time, opened from a trigger pinned to a
 * window edge or corner. The test calls `window.pfSet(kind, pos)`, opens the popup the way a person
 * does and measures it. `offender` is a seeded popup whose content is wider than any window: the
 * test must fail on it. The harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { ModelPicker } from '../../../src/ai/model-picker'
import { AppearanceSwitcher } from '../../../src/controls/appearance-switcher'
import { Button } from '../../../src/ui/button'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  Combobox,
} from '../../../src/ui/combobox'
import { DatePicker } from '../../../src/ui/date-picker'
import { InfoHint } from '../../../src/ui/info-hint'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
} from '../../../src/ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../../src/ui/popover'
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from '../../../src/ui/preview-card'
import { Select } from '../../../src/ui/select'
import { Tooltip } from '../../../src/ui/tooltip'

const POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const
type Pos = (typeof POSITIONS)[number]

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'A rather long option label that wants more room than a small window has' },
  { value: 'c', label: 'Gamma' },
]
const MODELS = [
  {
    label: 'Anthropic',
    options: [
      { value: 'opus', label: 'Opus' },
      { value: 'sonnet', label: 'Sonnet' },
    ],
  },
]
const ACCENTS = ['blue', 'violet', 'teal'] as const
const LONG = 'A rather long menu item label that wants more room than a small window has'

/** The anchor box pinned to `pos`: a fixed 120 x 36 box, or 200 wide for a field. */
function placed(pos: Pos, width: number): CSSProperties {
  const style: CSSProperties = { position: 'fixed', width, height: 36 }
  if (pos.includes('top')) style.top = 0
  else if (pos.includes('bottom')) style.bottom = 0
  else style.top = 'calc(50% - 18px)'
  if (pos.endsWith('left') || pos === 'left') style.left = 0
  else if (pos.endsWith('right') || pos === 'right') style.right = 0
  else style.left = `calc(50% - ${width / 2}px)`
  return style
}

function VirtualMenu(): ReactElement {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState({ x: 0, y: 0 })
  return (
    <>
      <Button
        data-testid="pf-trigger"
        className="size-full"
        onClick={(event) => {
          const r = event.currentTarget.getBoundingClientRect()
          setAt({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
          setOpen(true)
        }}
      >
        Context
      </Button>
      <Menu open={open} onOpenChange={setOpen}>
        <MenuContent
          aria-label="Photo actions"
          anchor={{ getBoundingClientRect: () => new DOMRect(at.x, at.y, 0, 0) }}
        >
          <MenuItem>Open</MenuItem>
          <MenuItem>{LONG}</MenuItem>
        </MenuContent>
      </Menu>
    </>
  )
}

const WIDE = 'w-[700px] h-8 bg-accent'

const FIELD_KINDS = ['select', 'combobox', 'autocomplete', 'date-picker', 'model-picker']

function Case({ kind }: { kind: string }): ReactElement {
  const trigger = <Button data-testid="pf-trigger" className="size-full" />
  switch (kind) {
    case 'popover':
      return (
        <Popover>
          <PopoverTrigger render={trigger}>Filters</PopoverTrigger>
          <PopoverContent aria-label="Filters">
            <p>A line of content.</p>
          </PopoverContent>
        </Popover>
      )
    case 'appearance':
      // The header's global-action popover: the shell renders `action.content` in a default PopoverContent.
      return (
        <Popover>
          <PopoverTrigger render={trigger}>Appearance</PopoverTrigger>
          <PopoverContent aria-label="Appearance">
            <AppearanceSwitcher accents={ACCENTS} />
          </PopoverContent>
        </Popover>
      )
    case 'appearance-w80':
      // What an app wrote before: a fixed width wider than the default popup.
      return (
        <Popover>
          <PopoverTrigger render={trigger}>Appearance</PopoverTrigger>
          <PopoverContent aria-label="Appearance">
            <AppearanceSwitcher accents={ACCENTS} className="w-80" />
          </PopoverContent>
        </Popover>
      )
    case 'appearance-sub':
      // The header's kebab on a compact window: the same content in a menu submenu.
      return (
        <Menu>
          <MenuTrigger render={trigger}>More</MenuTrigger>
          <MenuContent aria-label="More">
            <MenuSub label="Appearance">
              <AppearanceSwitcher accents={ACCENTS} />
            </MenuSub>
          </MenuContent>
        </Menu>
      )
    case 'offender':
      return (
        <Popover>
          <PopoverTrigger render={trigger}>Offender</PopoverTrigger>
          <PopoverContent aria-label="Offender">
            <div className={WIDE}>wider than any window</div>
          </PopoverContent>
        </Popover>
      )
    case 'menu':
      return (
        <Menu>
          <MenuTrigger render={trigger}>Actions</MenuTrigger>
          <MenuContent aria-label="Actions">
            <MenuItem>Rename</MenuItem>
            <MenuItem>{LONG}</MenuItem>
            <MenuSeparator />
            <MenuItem>Delete</MenuItem>
          </MenuContent>
        </Menu>
      )
    case 'menu-sub':
      return (
        <Menu>
          <MenuTrigger render={trigger}>Actions</MenuTrigger>
          <MenuContent aria-label="Actions">
            <MenuSub label="Move to">
              <MenuItem>Inbox</MenuItem>
              <MenuItem>{LONG}</MenuItem>
            </MenuSub>
          </MenuContent>
        </Menu>
      )
    case 'context-menu':
      return <VirtualMenu />
    case 'select':
      return <Select aria-label="Stage" options={OPTIONS} defaultValue="a" />
    case 'select-search':
      return <Select aria-label="Stage" options={OPTIONS} searchable placeholder="Pick one" />
    case 'combobox':
      return <Combobox aria-label="Stage" options={OPTIONS} placeholder="Search" />
    case 'autocomplete':
      return (
        <Autocomplete items={[LONG, 'Alpha', 'Beta']}>
          <AutocompleteInput aria-label="City" />
          <AutocompleteContent>
            {(item: string) => (
              <AutocompleteItem key={item} value={item}>
                {item}
              </AutocompleteItem>
            )}
          </AutocompleteContent>
        </Autocomplete>
      )
    case 'date-picker':
      return <DatePicker aria-label="Due" defaultValue="2026-11-24" />
    case 'model-picker':
      return <ModelPicker aria-label="Model" options={MODELS} defaultValue="opus" />
    case 'tooltip':
      return (
        <Tooltip label={`${LONG} and then some more words so the label runs long`} delay={0}>
          <Button data-testid="pf-trigger" className="size-full">
            Tip
          </Button>
        </Tooltip>
      )
    case 'preview-card':
      return (
        <PreviewCard>
          <PreviewCardTrigger href="#12" data-testid="pf-trigger" delay={0}>
            #12
          </PreviewCardTrigger>
          <PreviewCardContent>Retry the deploy. Open, owner unassigned.</PreviewCardContent>
        </PreviewCard>
      )
    case 'info-hint':
      return <InfoHint label="Hint">{LONG}</InfoHint>
    default:
      throw new Error(`popup-fit: unknown kind ${kind}`)
  }
}

function Fixture(): ReactElement {
  const [c, setC] = useState<{ kind: string; pos: Pos }>({ kind: 'popover', pos: 'right' })
  useEffect(() => {
    ;(window as unknown as { pfSet: (kind: string, pos: string) => void }).pfSet = (kind, pos) =>
      setC({ kind, pos: pos as Pos })
  }, [])
  return (
    <main className="min-h-dvh bg-background text-foreground" data-testid="pf-page">
      <div
        key={`${c.kind}-${c.pos}`}
        data-testid="pf-anchor"
        style={placed(c.pos, FIELD_KINDS.includes(c.kind) ? 200 : 120)}
      >
        <Case kind={c.kind} />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
