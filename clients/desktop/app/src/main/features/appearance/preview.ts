/** @fileoverview Retains the validated font files of the active preview until its replacement or release. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseAppearancePreviewInput,
  type AppearancePreview,
  type AppearancePreviewInput,
  type ThemeFont,
  type ThemeFontResourceFile,
} from '@kisaki3/desktop-contracts/appearance'
import type { FontTokenName } from '@kisaki3/desktop-appearance/tokens'
import { createSignal } from '../../infrastructure/events'

/** Verified immutable files held together for one font selection. */
export interface ThemeFontRead {
  files: readonly ThemeFontResourceFile[]
  /** Releases the read without invalidating already bound documents. */
  dispose(): Promise<void>
}

/** Reader bound by the actual extension instance to its installed or private resource roots. */
export type PrivateFontRead = (
  font: Extract<ThemeFont, { type: 'extension' }>,
) => Promise<ThemeFontRead>

/** Owns exactly one preview; requests prepare a complete replacement before transferring ownership. */
export function createPreviews(
  slots: readonly FontTokenName[],
  acquire: (font: ThemeFont, read?: PrivateFontRead) => Promise<ThemeFontRead | null>,
  changed: () => void,
) {
  let generation = 0

  /** Acquires each distinct selection once and releases partial reads on any failure. */
  async function prepare(input: AppearancePreviewInput, read?: PrivateFontRead) {
    const value = parseAppearancePreviewInput(input)
    const unique = new Map<string, ThemeFontRead | null>()
    const resources: Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>> = {}
    /** Releases the group of read handles owned by this prepared branch. */
    const dispose = async () => {
      await Promise.all(
        [...unique.values()].map(async (item) => {
          await item?.dispose()
        }),
      )
    }
    try {
      for (const slot of slots) {
        const font = value.tokens[slot]
        const key = JSON.stringify(font)
        if (!unique.has(key)) {
          unique.set(key, await acquire(font, read))
        }
        const file = unique.get(key)
        if (file) {
          resources[slot] = file.files
        }
      }
      return { input: value, resources, dispose }
    } catch (error) {
      await dispose()
      throw error
    }
  }

  let active:
    | { branch: Awaited<ReturnType<typeof prepare>>; end: (replacement?: boolean) => Promise<void> }
    | undefined
  return {
    /** Supplies the fixed branch and its held files to each document's own binder. */
    get current() {
      return active?.branch
    },
    /** Publishes the prepared branch, notifying the previous editor once on successful takeover. */
    async open(
      this: void,
      input: AppearancePreviewInput,
      read?: PrivateFontRead,
    ): Promise<AppearancePreview> {
      const number = ++generation
      const first = await prepare(input, read)
      if (number !== generation) {
        await first.dispose()
        throw new DesktopError('Cancelled', 'A newer preview was requested')
      }
      /** Delivers termination once to every editor observing this handle. */
      const ended = createSignal<void>()
      let revision = 0
      let releasing: Promise<void> | undefined
      const previous = active
      /** Ends this handle without clearing a newer editor's preview. */
      function end(replacement = false) {
        if (releasing) {
          return releasing
        }
        if (active === owned) {
          active = undefined
        }
        releasing = owned.branch.dispose()
        ended.emit()
        ended.clear()
        if (!replacement) {
          changed()
        }
        return releasing
      }
      const owned = { branch: first, end }
      active = owned
      const retiring = previous?.end(true)
      changed()
      await retiring?.catch((error) => console.error('Previous preview cleanup failed', error))
      return {
        /** Adopts a fully verified edit and releases the previous branch after publication. */
        async update(value) {
          if (active !== owned) {
            throw new DesktopError('InstanceExpired', 'The preview has ended')
          }
          const requested = ++revision
          const branch = await prepare(value, read)
          if (active !== owned || requested !== revision) {
            await branch.dispose()
            if (active !== owned) {
              throw new DesktopError('InstanceExpired', 'The preview has ended')
            }
            return
          }
          const original = owned.branch
          owned.branch = branch
          changed()
          await original.dispose()
        },
        /** Releases exactly this preview and restores the latest saved appearance. */
        dispose: () => end(),
        /** Delivers termination immediately to an observer of an already ended preview. */
        onDispose(listener) {
          if (active === owned) {
            return ended.on(listener)
          }
          listener()
          return {
            /** An already ended handle has no retained subscription. */ dispose() {},
          }
        },
      }
    },
    /** Revokes pending starts and releases the current preview on application exit. */
    async close() {
      generation++
      await active?.end()
    },
  }
}
