/** @fileoverview Types the local class mappings produced by the component CSS build. */

/** Declares the scoped class-name mapping returned by CSS Module imports. */
declare module '*.module.css' {
  /** Maps authored class identifiers to their emitted scoped class names. */
  const classes: Readonly<Record<string, string>>
  export default classes
}
