// Fixture: primitive-bypass/raw-control
// @invalid
const a = <button onClick={save}>Save</button>
// @invalid
const a = <input value={v} onChange={set} />
// @invalid
const a = (
  <select value={v}>
    <option>a</option>
  </select>
)
// @invalid
const a = <textarea value={v} />
// @invalid
const a = <input type={kind} />
// @valid
const a = <Button onClick={save}>Save</Button>
// @valid
const a = <Input value={v} />
// @valid
const a = <div role="presentation" />
// @valid
const a = <ui.Button />
// @valid
const a = <input type="file" className="sr-only" onChange={pick} />
// @valid
const a = <input type="file" className={cn('hidden', busy && 'opacity-50')} onChange={pick} />
// @valid
const a = <input type="file" hidden onChange={pick} />
// @invalid
const a = <input type="file" onChange={pick} />
// @invalid
const a = <input type="file" className="md:hidden" onChange={pick} />
