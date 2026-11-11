// Imports the date picker with every `parts` peer installed except its own, react-day-picker.
import { DatePicker } from 'basalt-ui/ui/date-picker'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root') as HTMLElement).render(
  <DatePicker value={null} onChange={() => undefined} />,
)
