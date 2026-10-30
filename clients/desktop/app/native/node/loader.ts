/**
 * @fileoverview Loads the explicitly selected desktop binding and adapts its exports to
 * application-owned capabilities.
 */

import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { createNativeFiles } from './files'
import type { NativeFiles } from './files'
import type * as Binding from './binding'

/** Native capabilities returned by loadNative(). */
export interface NativeCapabilities {
  files: NativeFiles
}

/** Loading failed before any capability was available; the original failure is retained. */
export class NativeLoadError extends Error {
  constructor(cause: unknown) {
    super('Could not load the desktop native module', { cause })
    this.name = 'NativeLoadError'
  }
}

/** Load the binding at the absolute deployment path; wrap load failures in NativeLoadError. */
export function loadNative(modulePath: string): NativeCapabilities {
  if (!isAbsolute(modulePath)) {
    throw new TypeError('Expected an absolute native module path')
  }

  try {
    const binding = createRequire(import.meta.url)(modulePath) as typeof Binding
    if (typeof binding.moveNoReplace !== 'function' || typeof binding.syncFile !== 'function') {
      throw new TypeError('The native module does not provide the required capabilities')
    }

    return { files: createNativeFiles(binding) }
  } catch (cause) {
    throw new NativeLoadError(cause)
  }
}
