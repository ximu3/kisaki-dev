/**
 * @fileoverview Loads the explicitly selected desktop binding and adapts its exports to
 * application-owned capabilities.
 */

import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { createNativeFiles } from './files'
import type { NativeFiles } from './files'
import type * as Binding from './binding'

/** Application-facing capabilities backed by the selected desktop native module. */
export interface NativeCapabilities {
  files: NativeFiles
}

/** Failure to load a usable native module, retaining the original loading or export error. */
export class NativeLoadError extends Error {
  /** Wraps the failure that prevented native capabilities from becoming available. */
  constructor(cause: unknown) {
    super('Could not load the desktop native module', { cause })
    this.name = 'NativeLoadError'
  }
}

/**
 * Loads the explicitly selected native module and exposes its application capabilities.
 *
 * Requires an absolute deployment path. Relative paths throw TypeError; loading or required-export
 * failures throw NativeLoadError with their cause.
 */
export function loadNative(modulePath: string): NativeCapabilities {
  if (!isAbsolute(modulePath)) {
    throw new TypeError('Expected an absolute native module path')
  }

  try {
    const binding = createRequire(import.meta.url)(modulePath) as typeof Binding
    if (
      typeof binding.moveNoReplace !== 'function' ||
      typeof binding.syncFile !== 'function' ||
      typeof binding.getFilesystemLocation !== 'function'
    ) {
      throw new TypeError('The native module does not provide the required capabilities')
    }

    return { files: createNativeFiles(binding) }
  } catch (cause) {
    throw new NativeLoadError(cause)
  }
}
