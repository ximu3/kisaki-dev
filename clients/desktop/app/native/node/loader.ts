/**
 * @fileoverview Loads the explicitly selected desktop binding and adapts its exports to
 * application-owned capabilities.
 */

import { createRequire } from 'node:module'
import { isAbsoluteHostPath } from '#host-path'
import { createNativeFiles } from './files'
import type { NativeFiles } from './files'
import type * as Binding from './binding'

/** Application-facing capabilities backed by the selected desktop native module. */
export interface NativeCapabilities {
  files: NativeFiles
  /** Reads the installed font families on the native worker pool. */
  listFontFamilies: typeof Binding.listFontFamilies
  /** Connects the OS receiver before activation can reach the application. */
  setNotificationReceiver: typeof Binding.setNotificationReceiver
  /** Returns OS acceptance or denied permission for one native submission. */
  postNotification(appId: string, identifier: string, title: string, body: string): Promise<boolean>
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
  if (!isAbsoluteHostPath(modulePath)) {
    throw new TypeError('Expected an absolute native module path')
  }

  try {
    const binding = createRequire(import.meta.url)(modulePath) as typeof Binding
    if (
      typeof binding.moveNoReplace !== 'function' ||
      typeof binding.syncFile !== 'function' ||
      typeof binding.getFilesystemLocation !== 'function' ||
      typeof binding.sameDirectoryEntry !== 'function' ||
      typeof binding.listFontFamilies !== 'function' ||
      typeof binding.setNotificationReceiver !== 'function' ||
      typeof binding.postSystemNotification !== 'function'
    ) {
      throw new TypeError('The native module does not provide the required capabilities')
    }

    return {
      files: createNativeFiles(binding),
      listFontFamilies: binding.listFontFamilies,
      setNotificationReceiver: binding.setNotificationReceiver,
      /** Adapts the platform's completion callback to the application promise. */
      postNotification(appId, identifier, title, body) {
        return new Promise((resolve, reject) => {
          binding.postSystemNotification(appId, identifier, title, body, (error, accepted) => {
            if (error) {
              reject(error)
            } else {
              resolve(accepted === true)
            }
          })
        })
      },
    }
  } catch (cause) {
    throw new NativeLoadError(cause)
  }
}
