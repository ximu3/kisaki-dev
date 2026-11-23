declare module '*.module.css' {
  /** Maps authored class identifiers to their emitted scoped class names. */
  const classes: Readonly<Record<string, string>>
  export default classes
}
