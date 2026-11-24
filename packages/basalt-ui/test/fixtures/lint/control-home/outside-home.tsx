// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).
// Every invalid block reports `outside-home` once unless `// @errors` says otherwise.

// @invalid
import { Select } from 'basalt-ui/ui/select'
export const Body = () => (
  <Section title="Units">
    <Select value={unit} onValueChange={setUnit} />
  </Section>
)

// @invalid
import { Switch } from 'basalt-ui/ui/switch'
export const Row = () => <Switch checked={on} onCheckedChange={setOn} />

// @invalid
import { Checkbox } from '@/components/ui/checkbox'
export const Page = () => (
  <Page>
    <Checkbox checked={all} />
  </Page>
)

// @invalid
import { Slider } from 'basalt-ui/ui/slider'
export const Bar = () => <PageBar controls={<Slider value={v} />} />

// @invalid
import { Slider } from 'basalt-ui/ui/slider'
export const slot = (handle) =>
  filterSlot.custom(handle, 'Opacity', () => {
    const [opacity, setOpacity] = useState(0.5)
    return <Slider value={opacity} onValueChange={setOpacity} />
  })

// @invalid
import { Select } from 'basalt-ui/ui/select'
export const Mismatch = () => (
  <Card field={store.search}>
    <Select value={v} />
  </Card>
)

// @invalid
import { RadioGroup } from 'basalt-ui/ui/radio-group'
export const Two = () => (
  <>
    <RadioGroup value={a} />
    <RadioGroup value={b} />
  </>
)
// @errors outside-home,outside-home

// @invalid
import { RadioGroup, Radio } from 'basalt-ui/ui/radio-group'
export const Parts = () => (
  <RadioGroup value={a}>
    <Radio value="x" />
    <Radio value="y" />
  </RadioGroup>
)

// @invalid
import { Select, SelectTrigger, SelectContent, SelectItem } from 'basalt-ui/ui/select'
export const Composed = () => (
  <Select value={a}>
    <SelectTrigger />
    <SelectContent>
      <SelectItem value="x" />
    </SelectContent>
  </Select>
)

// @invalid
import { useState } from 'react'
import { Slider } from 'basalt-ui/ui/slider'
export function Panel(handle) {
  const [opacity, setOpacity] = useState(0.5)
  return filterSlot.custom(handle, 'Opacity', () => (
    <Slider value={opacity} onValueChange={setOpacity} />
  ))
}

// @valid
import { Select } from 'basalt-ui/ui/select'
export const Wrapped = () => (
  <FormField label="Unit">
    <Select value={unit} onValueChange={setUnit} />
  </FormField>
)

// @valid
import { Input } from 'basalt-ui/ui/input'
export const Bound = () => (
  <form.AppField name="name">
    {(f) => (
      <f.FormField label="Name">
        <Input />
      </f.FormField>
    )}
  </form.AppField>
)

// @invalid
import { Select } from 'basalt-ui/ui/select'
export const NotBound = () => (
  <f.Wrapper>
    <Select value={unit} onValueChange={setUnit} />
  </f.Wrapper>
)

// @valid
import { Segmented } from 'basalt-ui/ui/segmented'
export const Filters = () => (
  <FilterSet>
    <Segmented value={v} />
  </FilterSet>
)

// @valid
import { Combobox } from 'basalt-ui/ui/combobox'
export const Panel = () => (
  <ControlHome home="side-panel">
    <Combobox value={v} />
  </ControlHome>
)

// @valid
import { NumberField } from 'basalt-ui/ui/number-field'
export const Views = () => (
  <ViewTabs>
    <NumberField value={n} />
  </ViewTabs>
)

// @valid
import { Slider } from 'basalt-ui/ui/slider'
export const slot = (handle) =>
  filterSlot.custom(handle, 'Opacity', ({ value, set }) => <Slider value={value} onValueChange={set} />)

// @valid
import { Switch } from 'basalt-ui/ui/switch'
export const Composite = () => (
  <PublicRow handle={overview.field.public}>
    <Switch />
  </PublicRow>
)

// @valid
import { Switch } from 'basalt-ui/ui/switch'
const range = store.field.range
export const Hoisted = () => (
  <Row control={range}>
    <Switch />
  </Row>
)

// @valid
import { Switch } from 'basalt-ui/ui/switch'
export const Hoisted = () => (
  <Row field={range}>
    <Switch />
  </Row>
)
const range = store.field.range

// @valid
import { useState } from 'react'
import { Slider } from 'basalt-ui/ui/slider'
export function Panel(handle) {
  const [open, setOpen] = useState(false)
  return filterSlot.custom(handle, 'Opacity', ({ value, set }) => (
    <Slider value={value} onValueChange={set} onPointerDown={() => setOpen(true)} />
  ))
}

// @valid
import { useState } from 'react'
import { Slider } from 'basalt-ui/ui/slider'
export function Other() {
  const [value, setValue] = useState(0)
  return value + setValue
}
export function Panel(handle) {
  return filterSlot.custom(handle, 'Opacity', ({ value, set }) => (
    <Slider value={value} onValueChange={set} />
  ))
}

// @valid
import { SelectItem } from 'basalt-ui/ui/select'
export const Part = () => <SelectItem value="x" />

// @valid
import { Select } from './select'
export const Local = () => <Select value={v} />

// @valid
import { Input } from 'basalt-ui/ui/input'
export const Text = () => <Input value={v} />

// @invalid
import { useState } from 'react'
import { Input } from 'basalt-ui/ui/input'
export function Search() {
  const [q, setQ] = useState('')
  return <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search runs" />
}

// @invalid
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'
export function Views() {
  const [view, setView] = useState('table')
  return (
    <Tabs value={view} onValueChange={(v) => setView(String(v))}>
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="chart">Chart</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

// @valid
import { Tabs, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'
export const Details = () => (
  <Tabs defaultValue="details">
    <TabsList>
      <TabsTrigger value="details">Details</TabsTrigger>
    </TabsList>
  </Tabs>
)

// @valid
import { useState } from 'react'
import { Input } from 'basalt-ui/ui/input'
export function Field() {
  const [q, setQ] = useState('')
  return (
    <FormField label="Name">
      <Input value={q} onChange={(e) => setQ(e.target.value)} />
    </FormField>
  )
}
