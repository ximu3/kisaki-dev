/* @fileoverview Publishes only the conditions whose files ship in the package. */

/** Manifest transformations applied by pnpm when producing the final tarball. */
export const hooks = {
  /**
   * Removes workspace source conditions while retaining declaration and runtime entry order.
   * @param {{ exports?: Record<string, string | Record<string, string>> }} manifest
   */
  beforePacking(manifest) {
    for (const entry of Object.values(manifest.exports ?? {})) {
      if (typeof entry === 'object' && entry !== null) {
        delete entry['kisaki-source']
      }
    }
    return manifest
  },
}
