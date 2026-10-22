import { NumberInput, PasswordInput, Textarea, TextInput } from '@mantine/core'
import type { ReactElement } from 'react'
import { FormGroup, FormRow } from '../../../src/controls'

/**
 * Wave 46 (SPEC § 6.13): two `FormGroup section`s of two rows each in a 700 px column (the beside
 * layout), plus a row whose control states `size="md"` (the opt-out), and a 370 px column (stacked).
 * Every control carries a data-testid the geometry test measures.
 */
export function FormsW46Fixture(): ReactElement {
  return (
    <>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w46-form" style={{ width: 700 }}>
        <FormGroup label="Profile" section>
          <FormRow label="Name" htmlFor="w46-name">
            <TextInput id="w46-name" data-testid="w46-name" />
          </FormRow>
          <FormRow label="Weight" htmlFor="w46-weight">
            <NumberInput id="w46-weight" data-testid="w46-weight" />
          </FormRow>
        </FormGroup>
        <FormGroup label="Security" section>
          <FormRow label="Passphrase" htmlFor="w46-pass">
            <PasswordInput id="w46-pass" data-testid="w46-pass" />
          </FormRow>
          <FormRow label="Notes" htmlFor="w46-notes">
            <Textarea id="w46-notes" data-testid="w46-notes" autosize minRows={1} />
          </FormRow>
          <FormRow label="Roomy" htmlFor="w46-md">
            <TextInput id="w46-md" size="md" data-testid="w46-md" />
          </FormRow>
        </FormGroup>
      </div>
    </>
  )
}
