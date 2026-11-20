// expect: ml-2
// expect: mr-px
// expect: md:ml-4
// expect: -ml-px
// expect: !mr-0
// expect: ml-auto
export const a = <div className="ml-2 mr-px md:ml-4 -ml-px !mr-0" />
export const b = <div className="ml-auto" />
