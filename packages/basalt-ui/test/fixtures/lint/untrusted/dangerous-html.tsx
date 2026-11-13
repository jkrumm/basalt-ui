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
