/** @fileoverview Types the local class mappings produced by the component CSS build. */

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
