// Fixture: primitive-bypass/intl-format. The form is off in the table; the test enables it.
// @invalid
const f = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' })
// @invalid
const f = new Intl.NumberFormat('en-US').format(n)
// @invalid
const s = d.toLocaleDateString('de-DE')
// @invalid
const s = n.toLocaleString()
// @invalid
const f = Intl.RelativeTimeFormat('en')
// @valid
const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone
// @valid
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
// @valid
const f = new Intl.PluralRules('en')
// @valid
const s = format.number(n)
// @valid
const s = list.toString()
