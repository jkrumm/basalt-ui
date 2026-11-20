import { Button } from 'basalt-ui/ui/button'
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
} from 'basalt-ui/ui/menu'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Menu>
      <MenuTrigger render={<Button variant="secondary" />}>Run actions</MenuTrigger>
      <MenuContent>
        <MenuGroup label="Run">
          <MenuItem>Open</MenuItem>
          <MenuItem>Duplicate</MenuItem>
          <MenuSub label="Export">
            <MenuItem>GPX</MenuItem>
            <MenuItem>CSV</MenuItem>
          </MenuSub>
        </MenuGroup>
        <MenuSeparator />
        <MenuCheckboxItem defaultChecked>Show splits</MenuCheckboxItem>
        <MenuRadioGroup defaultValue="km">
          <MenuRadioItem value="km">Kilometres</MenuRadioItem>
          <MenuRadioItem value="mi">Miles</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem>Delete</MenuItem>
      </MenuContent>
    </Menu>
  )
}
