import { createRoot } from 'react-dom/client'
import { MiniBars } from '../mini-bars'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <MiniBars
      points={[3, 1, 4, 1, 5, 9, 2, 6]}
      label="probe"
      height={72}
      axisLabels={['a', 'b', 'c']}
    />,
  )
}
