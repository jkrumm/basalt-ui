// A raw select as a child of a Section body: no home among its ancestors.
import { useState } from 'react'
import { Section } from 'basalt-ui/page'
import { Select } from 'basalt-ui/ui/select'

export function Body() {
  const [unit, setUnit] = useState('kg')
  return (
    <Section title="Units">
      <Select value={unit} onValueChange={setUnit} />
    </Section>
  )
}
