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
