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
// @invalid
const a = (
  <div role="button" tabIndex={0} onClick={open}>
    Open
  </div>
)
// @invalid
const a = <span role="button" onClick={open} />
// @invalid
const a = <dialog open>Delete?</dialog>
// @valid
const a = <div role="button" />
// @valid
const a = <div role="group" onClick={open} />
// @valid
const a = <Dialog open />
// @invalid
const a = <a onClick={onMore}>More</a>
// @valid
const a = (
  <a href="/runs" onClick={track}>
    Runs
  </a>
)
// @valid
const a = <a {...props} onClick={onMore} />
// @invalid
const a = (
  <li tabIndex={0} onClick={open} onKeyDown={onKey}>
    Row
  </li>
)
// @invalid
const a = <tr onClick={open} />
// @invalid
const a = <img src={src} onClick={zoom} />
// @valid
const a = <li role="option">Row</li>
// @valid
const a = <li role="option" onClick={pick} />
// @valid
const a = <li {...props} onClick={pick} />
// @valid
const a = <li>Row</li>
// @valid
const a = <div onClick={stop}>Row</div>
// @invalid
const a = <progress value={used} max={100} />
// @invalid
const a = <meter value={used} min={0} max={100} />
// @valid
const a = <Progress value={used} />
