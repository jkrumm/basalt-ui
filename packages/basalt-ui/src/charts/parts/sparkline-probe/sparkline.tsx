import { createRoot } from 'react-dom/client'
import { Sparkline } from '../sparkline'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <Sparkline
      series={[3, 1, 4, 1, 5, 9, 2, 6]}
      ariaLabel="probe"
      height={72}
      form="area"
      reference="mean"
      axisLabels={['a', 'b', 'c']}
    />,
  )
}
