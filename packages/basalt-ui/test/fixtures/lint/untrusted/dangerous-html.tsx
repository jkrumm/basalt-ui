// Blocks: see ../structure-rest/color-literal.tsx.

// @invalid
const a = <div dangerouslySetInnerHTML={{ __html: html }} />

// @invalid
const a = <div dangerouslySetInnerHTML={{ __html: `<b>${name}</b>` }} />

// @invalid
const a = <div dangerouslySetInnerHTML={props.inner} />

// @valid
const a = <div dangerouslySetInnerHTML={{ __html: '<b>fixed</b>' }} />

// @valid
const a = <div className="x" />

// @invalid
el.innerHTML = m.html

// @invalid
el.outerHTML = `<b>${name}</b>`

// @invalid
el.insertAdjacentHTML('beforeend', m.html)

// @valid
el.innerHTML = ''

// @valid
el.insertAdjacentHTML('beforeend', '<hr>')

// @valid
el.textContent = m.html

// @invalid
const a = <iframe srcDoc={m.html} />

// @invalid
const a = <iframe srcDoc={`<b>${name}</b>`} />

// @valid
const a = <iframe srcDoc="<b>fixed</b>" />

// @valid
const a = <iframe srcDoc={'<b>fixed</b>'} />

// @valid
const a = <iframe srcDoc={`<b>fixed</b>`} />

// @valid
const a = <iframe src={m.url} />

// @invalid
const f = document.createRange().createContextualFragment(m.html)

// @invalid
const f = range.createContextualFragment(`<b>${name}</b>`)

// @valid
const f = range.createContextualFragment('<hr>')

// @valid
const f = range.createContextualFragment(`<hr>`)

// @valid
const a = <iframe title="Preview" sandbox="allow-scripts" srcDoc={CSP + a.body} />

// @valid
const a = <iframe sandbox srcDoc={m.html} />

// @invalid
const a = <iframe sandbox="allow-scripts allow-same-origin" srcDoc={m.html} />

// @invalid
const a = <iframe sandbox={mode} srcDoc={m.html} />

// @invalid
const a = <iframe sandbox="allow-scripts ALLOW-SAME-ORIGIN" srcDoc={m.html} />

// @invalid
w?.document.write(m.html)

// @invalid
document.write(`<b>${name}</b>`)

// @invalid
frame.contentWindow.document.writeln(m.html)

// @valid
w.document.write('<p>fixed</p>')

// @valid
w.document.write(`<p>fixed</p>`)

// @valid
stream.write(m.html)

// @invalid
const doc = new DOMParser().parseFromString(r.html, 'text/html')
el.replaceChildren(...doc.body.childNodes)

// @invalid
const doc = parser.parseFromString(`<p>${name}</p>`, 'text/html')

// @valid
const doc = new DOMParser().parseFromString('<p>fixed</p>', 'text/html')

// @valid
const doc = new DOMParser().parseFromString(m.xml, 'text/xml')

// @valid
const doc = new DOMParser().parseFromString(m.svg, 'image/svg+xml')

// @invalid
host.setHTMLUnsafe(m.html)

// @invalid
const doc = Document.parseHTMLUnsafe(m.html)

// @valid
host.setHTMLUnsafe('<p>fixed</p>')

// @valid
const doc = Document.parseHTMLUnsafe(`<p>fixed</p>`)
