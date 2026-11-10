// `base0` (docs/v3/concepts/quality-contract.md section 6): React + react-dom `createRoot` and the
// same child, no provider. Built beside `provider-v3.tsx` in one run; the difference is the provider.
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (root !== null) createRoot(root).render(<div />)
