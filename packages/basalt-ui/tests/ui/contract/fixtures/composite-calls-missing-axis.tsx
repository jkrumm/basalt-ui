// A deliberate offender: `danger` is a real Button variant, but the button guard's `requires` block
// does not list it, so guard-completeness must fail here.
import { Button } from 'basalt-ui/ui/button'

export function DeleteAction() {
  return <Button variant="danger">Delete</Button>
}
