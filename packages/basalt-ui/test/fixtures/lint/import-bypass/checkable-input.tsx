// Fixture: primitive-bypass/checkable-input
// @invalid
const a = <input type="checkbox" checked={on} />
// @invalid
const a = <input type="radio" name="g" />
// @invalid
const a = <input type={'checkbox'} />
// @valid
const a = <Checkbox checked={on} />
// @valid
const a = <RadioGroup value={v} />
// @valid
const a = <Switch checked={on} />
// @invalid
import { Input } from 'basalt-ui/ui/input'
const a = <Input type="checkbox" checked={on} />
// @invalid
import { Input as Field } from 'basalt-ui/ui/input'
const a = <Field type="radio" name="g" />
// @valid
import { Input } from 'basalt-ui/ui/input'
const a = <Input type="email" value={v} />
// @valid
import { Input } from './local-input'
const a = <Input type="checkbox" />
// @valid
import { Checkbox } from 'basalt-ui/ui/checkbox'
const a = <Checkbox checked={on} />
