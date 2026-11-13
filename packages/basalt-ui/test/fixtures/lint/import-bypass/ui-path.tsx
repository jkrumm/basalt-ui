// Fixture: import-boundary/ui-path. An @valid / @invalid marker may carry options as JSON.
// @invalid
import { Button } from '@/components/ui/button'
// @invalid
import { Card } from '@/components/ui/card'
// @invalid {"ejected":["@/components/ui/card"]}
import { Button } from '@/components/ui/button'
// @valid
import { Button } from 'basalt-ui/ui/button'
// @valid {"ejected":["@/components/ui/button"]}
import { Button } from '@/components/ui/button'
// @valid {"ejected":["src/components/ui/button.tsx"]}
import { Button } from '@/components/ui/button'
// @valid
import { Page } from '@/components/page'
