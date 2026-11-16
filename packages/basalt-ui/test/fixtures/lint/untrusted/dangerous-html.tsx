// Blocks: see ../structure-rest/colour-literal.tsx.

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
