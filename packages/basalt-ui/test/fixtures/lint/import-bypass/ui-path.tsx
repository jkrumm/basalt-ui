// Fixture: import-boundary/ui-path. An @valid / @invalid marker may carry options as JSON.
// @invalid
import { Button } from '@/components/ui/button'
// @invalid
import { Card } from '@/components/ui/card'
// @invalid {"ejected":["@/components/ui/card"]}
import { Button } from '@/components/ui/button'
// @invalid
import { Input } from '../components/ui/input'
// @invalid
import { Button } from './components/ui/button'
// @invalid
import { Button } from '../../components/ui/button.tsx'
// @invalid
import { Button } from '~/components/ui/button'
// @invalid {"ejected":["@/components/ui/card"]}
import { Input } from '../components/ui/input'
// @valid {"ejected":["src/components/ui/input.tsx"]}
import { Input } from '../components/ui/input'
// @valid {"ejected":["@/components/ui/button"]}
import { Button } from './components/ui/button'
// @valid
import { Page } from '../components/page'
// @valid
import { Button } from 'some-kit/components/ui/button'
// @valid
import { Button } from 'basalt-ui/ui/button'
// @valid {"ejected":["@/components/ui/button"]}
import { Button } from '@/components/ui/button'
// @valid {"ejected":["src/components/ui/button.tsx"]}
import { Button } from '@/components/ui/button'
// @valid
import { Page } from '@/components/page'
// @invalid
import { Button } from 'src/components/ui/button'
// @invalid
import { Badge } from '#/components/ui/badge'
// @valid {"ejected":["#/components/ui/badge"]}
import { Badge } from '#/components/ui/badge'
// @valid
import { Page } from '#/components/page'
// @valid
import { Page } from 'src/components/page'
