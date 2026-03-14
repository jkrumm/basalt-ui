'use client'

import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconDatabase,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip } from '@/components/ui/tooltip'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-caption font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

export function ComponentShowcase() {
  return (
    <div className="rounded bg-card border border-border p-6">
      <h2 className="mb-6 text-h5 font-bold">Component Kit</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Inputs */}
          <div>
            <SectionLabel>Inputs</SectionLabel>
            <div className="space-y-2">
              <Input placeholder="Default input" />
              <Input placeholder="Placeholder text" />
              <Input defaultValue="With value" />
              <Input disabled placeholder="Disabled input" />
              <Input
                className="border-destructive focus-visible:ring-destructive/30"
                defaultValue="Error state"
                aria-invalid="true"
              />
              <Input type="search" placeholder="Search..." />
            </div>
          </div>

          {/* Input Groups */}
          <div>
            <SectionLabel>Input Groups</SectionLabel>
            <div className="space-y-2">
              <InputGroup hasLeftAddon>
                <InputGroupAddon icon={IconSearch} side="left" />
                <Input placeholder="Search..." />
              </InputGroup>
              <InputGroup hasLeftAddon hasRightAddon>
                <InputGroupAddon icon={IconDatabase} side="left" />
                <Input placeholder="Database query..." />
                <InputGroupAddon icon={IconCheck} side="right" />
              </InputGroup>
            </div>
          </div>

          {/* Select */}
          <div>
            <SectionLabel>Select</SectionLabel>
            <div className="flex gap-2">
              <select className="flex h-6 w-full items-center justify-between rounded border border-input bg-input/20 px-2 py-1 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
                <option>Option A</option>
                <option>Option B</option>
                <option>Option C</option>
              </select>
              <select
                disabled
                className="flex h-6 w-full items-center justify-between rounded border border-input bg-input/20 px-2 py-1 text-xs text-muted-foreground opacity-50 outline-none"
              >
                <option>Disabled</option>
              </select>
            </div>
          </div>

          {/* Slider */}
          <div>
            <SectionLabel>Slider</SectionLabel>
            <div className="space-y-4 px-1">
              <Slider defaultValue={[40]} />
              <Slider defaultValue={[20, 70]} intent="success" />
              <Slider defaultValue={[60]} intent="warning" labelRenderer={(v) => `${v}%`} />
              <Slider defaultValue={[80]} intent="danger" disabled />
            </div>
          </div>

          {/* Tabs */}
          <div>
            <SectionLabel>Tabs</SectionLabel>
            <div className="space-y-2">
              <Tabs defaultValue="tab1">
                <TabsList>
                  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                  <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                  <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs defaultValue="tab1">
                <TabsList variant="line">
                  <TabsTrigger value="tab1">Overview</TabsTrigger>
                  <TabsTrigger value="tab2">Analytics</TabsTrigger>
                  <TabsTrigger value="tab3" disabled>
                    Disabled
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Progress */}
          <div>
            <SectionLabel>Progress</SectionLabel>
            <div className="space-y-3">
              <Progress value={75}>
                <ProgressLabel>Tasks</ProgressLabel>
                <ProgressValue />
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <Progress value={40}>
                <ProgressLabel>Files</ProgressLabel>
                <ProgressValue />
                <ProgressTrack>
                  <ProgressIndicator className="bg-green" />
                </ProgressTrack>
              </Progress>
              <Progress value={20}>
                <ProgressLabel>Quota</ProgressLabel>
                <ProgressValue />
                <ProgressTrack>
                  <ProgressIndicator className="bg-red" />
                </ProgressTrack>
              </Progress>
            </div>
          </div>

          {/* Alerts */}
          <div>
            <SectionLabel>Alert</SectionLabel>
            <div className="space-y-2">
              <Alert title="Default notice">Something happened that you should know about.</Alert>
              <Alert intent="primary" icon={IconInfoCircle} title="Info">
                Primary intent with icon and body text.
              </Alert>
              <Alert intent="success" icon={IconShieldCheck} title="Success">
                Operation completed successfully.
              </Alert>
              <Alert intent="warning" icon={IconAlertTriangle} title="Warning">
                This action may have unintended consequences.
              </Alert>
              <Alert intent="danger" title="Error">
                Something went wrong. Please try again.
              </Alert>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Buttons */}
          <div>
            <SectionLabel>Buttons</SectionLabel>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Default</Button>
                <Button size="sm" variant="primary">
                  Primary
                </Button>
                <Button size="sm" variant="success">
                  Success
                </Button>
                <Button size="sm" variant="warning">
                  Warning
                </Button>
                <Button size="sm" variant="danger">
                  Danger
                </Button>
                <Button size="sm" variant="ghost">
                  Ghost
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" leftIcon={IconPlus}>
                  Add Item
                </Button>
                <Button size="sm" variant="primary" leftIcon={IconPlus} rightIcon={IconChevronDown}>
                  New
                </Button>
                <Button size="sm" variant="danger" leftIcon={IconTrash}>
                  Delete
                </Button>
                <Button size="sm" loading>
                  Loading
                </Button>
                <Button size="sm" variant="primary" loading>
                  Saving
                </Button>
                <Button size="sm" fill variant="success" leftIcon={IconCheck}>
                  Full width
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled>
                  Default
                </Button>
                <Button size="sm" variant="primary" disabled>
                  Primary
                </Button>
                <Button size="sm" variant="success" disabled>
                  Success
                </Button>
                <Button size="sm" variant="warning" disabled>
                  Warning
                </Button>
                <Button size="sm" variant="danger" disabled>
                  Danger
                </Button>
                <Button size="sm" variant="ghost" disabled>
                  Ghost
                </Button>
              </div>
            </div>
          </div>

          {/* Button Groups */}
          <div>
            <SectionLabel>Button Groups</SectionLabel>
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex">
                <Button size="sm" variant="primary" className="rounded-r-none">
                  Left
                </Button>
                <Button size="sm" variant="primary" className="-ml-px rounded-none bg-blue-1">
                  Center
                </Button>
                <Button size="sm" variant="primary" className="-ml-px rounded-l-none">
                  Right
                </Button>
              </div>
              <div className="inline-flex">
                <Button size="sm" className="rounded-r-none">
                  Cut
                </Button>
                <Button size="sm" className="-ml-px rounded-none">
                  Copy
                </Button>
                <Button size="sm" className="-ml-px rounded-l-none">
                  Paste
                </Button>
              </div>
            </div>
          </div>

          {/* Dropdown */}
          <div>
            <SectionLabel>Dropdown Menu</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm">
                      Actions <IconChevronDown />
                    </Button>
                  }
                />
                <DropdownMenuContent>
                  <DropdownMenuLabel>Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={IconDatabase} hint="⌘E">
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={IconPlus}>Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={IconTrash} intent="danger">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="primary">
                      New <IconChevronDown />
                    </Button>
                  }
                />
                <DropdownMenuContent>
                  <DropdownMenuItem>Project</DropdownMenuItem>
                  <DropdownMenuItem>Template</DropdownMenuItem>
                  <DropdownMenuItem>Import...</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tooltip */}
          <div>
            <SectionLabel>Tooltip</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Tooltip content="Default tooltip on top">
                <Button size="sm">Hover me</Button>
              </Tooltip>
              <Tooltip content="Shown below" side="bottom">
                <Button size="sm" variant="primary">
                  Below
                </Button>
              </Tooltip>
              <Tooltip content="Shown to the right" side="right">
                <Button size="sm" variant="ghost">
                  Right
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Toggle groups */}
          <div>
            <SectionLabel>Toggle Groups</SectionLabel>
            <div className="space-y-2">
              <ToggleGroup defaultValue={['b']} variant="outline">
                <ToggleGroupItem value="a">Left</ToggleGroupItem>
                <ToggleGroupItem value="b">Middle</ToggleGroupItem>
                <ToggleGroupItem value="c">Right</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup defaultValue={['x', 'y']}>
                <ToggleGroupItem value="x">Alpha</ToggleGroupItem>
                <ToggleGroupItem value="y">Beta</ToggleGroupItem>
                <ToggleGroupItem value="z" disabled>
                  Disabled
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Badges */}
          <div>
            <SectionLabel>Badges</SectionLabel>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="primary">Primary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="secondary">Muted</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="primary-minimal">Primary</Badge>
                <Badge variant="success-minimal">Success</Badge>
                <Badge variant="warning-minimal">Warning</Badge>
                <Badge variant="danger-minimal">Danger</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="primary" size="lg">
                  Large
                </Badge>
                <Badge variant="success" size="lg">
                  Success
                </Badge>
                <Badge variant="danger" onRemove={() => {}}>
                  Removable
                </Badge>
                <Badge variant="primary-minimal" interactive onClick={() => {}}>
                  Clickable
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Checkboxes */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <SectionLabel>Checkboxes</SectionLabel>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="cb1" />
                  <Label htmlFor="cb1" className="text-small">
                    Default
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="cb2" checked />
                  <Label htmlFor="cb2" className="text-small">
                    Checked
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="cb3" indeterminate />
                  <Label htmlFor="cb3" className="text-small">
                    Indeterminate
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="cb4" disabled />
                  <Label htmlFor="cb4" className="text-small text-muted-foreground">
                    Disabled
                  </Label>
                </div>
              </div>
            </div>

            {/* Radio buttons */}
            <div>
              <SectionLabel>Radio</SectionLabel>
              <RadioGroup defaultValue="r1" className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="r1" id="r1" />
                  <Label htmlFor="r1" className="text-small">
                    Option 1
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="r2" id="r2" />
                  <Label htmlFor="r2" className="text-small">
                    Option 2
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="r3" id="r3" disabled />
                  <Label htmlFor="r3" className="text-small text-muted-foreground">
                    Disabled
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Switches */}
            <div>
              <SectionLabel>Switches</SectionLabel>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch defaultChecked />
                  <span className="text-small">On</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch />
                  <span className="text-small">Off</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch disabled />
                  <span className="text-small text-muted-foreground">Disabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
