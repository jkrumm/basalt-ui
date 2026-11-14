// A composite that takes a field handle: the control's value is the handle's, the file is clean.
import { Switch } from 'basalt-ui/ui/switch'
import { overview } from './controls'

export function PublicSwitch() {
  return (
    <PublicRow handle={overview.field.public}>
      <Switch />
    </PublicRow>
  )
}
