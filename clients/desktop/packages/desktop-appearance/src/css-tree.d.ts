/** @fileoverview Declares the standalone ESM build of CSS Tree used by the pure appearance parser. */

declare module 'css-tree/dist/csstree.esm' {
  export { generate, ident, lexer, parse, walk } from 'css-tree'
}
