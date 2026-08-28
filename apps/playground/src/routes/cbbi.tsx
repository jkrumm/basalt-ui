import { createFileRoute } from '@tanstack/react-router'
import { CbbiPage } from '../demo/cbbi/CbbiPage'
import { cbbiFilters } from '../demo/cbbi/cbbi-store'

// The route owns the search VALIDATION for the page's six URL-lane fields, exactly as
// `routes/dashboard.tsx` does for its four — so every field resolves URL ⊳ localStorage ⊳ fallback
// (C4) and a deep link into a reading of the index is a real link. The nine weight fields are on
// the persist-only lane and deliberately never reach this validator.
export const Route = createFileRoute('/cbbi')({
  staticData: { title: 'CBBI' },
  validateSearch: cbbiFilters.validateSearch,
  component: CbbiPage,
})
