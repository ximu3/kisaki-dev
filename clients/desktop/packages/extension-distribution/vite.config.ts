/** @fileoverview Builds the extension package formats and the Node-only signing entry. */

import { defineLibrary } from '@kisaki3/config/vite/library'

export default defineLibrary({
  entries: {
    './manifest': './src/manifest.ts',
    './registry': './src/registry.ts',
    './metadata': './src/metadata.ts',
    './compatibility': './src/compatibility.ts',
    './errors': './src/errors.ts',
    './node/signing': './src/node/signing.ts',
  },
})
