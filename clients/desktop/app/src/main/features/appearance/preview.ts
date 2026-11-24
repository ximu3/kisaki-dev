import { releaseAll, rethrowAfterRelease } from '../../infrastructure/release'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
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

export interface ThemeFontRead {
  files: readonly ThemeFontResourceFile[]
  dispose(): Promise<void>
}

export type PrivateFontRead = (
  font: Extract<ThemeFont, { type: 'extension' }>,
) => Promise<ThemeFontRead>

export function createPreviews(
  slots: readonly FontTokenName[],
  acquire: (
    font: ThemeFont,
    read?: PrivateFontRead,
    options?: CallOptions,
  ) => Promise<ThemeFontRead | null>,
  changed: () => void,
) {
  let generation = 0

  async function prepare(
    input: AppearancePreviewInput,
    read?: PrivateFontRead,
    options?: CallOptions,
  ) {
    const value = parseAppearancePreviewInput(input)
    const unique = new Map<string, ThemeFontRead | null>()
    const resources: Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>> = {}
    const dispose = async () => {
      await releaseAll([...unique.values()].map((item) => () => item?.dispose()))
    }
    try {
      for (const slot of slots) {
        options?.signal?.throwIfAborted()
        const font = value.tokens[slot]
        const key = JSON.stringify(font)
        if (!unique.has(key)) {
          unique.set(key, await acquire(font, read, options))
        }
        const file = unique.get(key)
        if (file) {
          resources[slot] = file.files
        }
      }
      options?.signal?.throwIfAborted()
      return { input: value, resources, dispose }
    } catch (error) {
      return rethrowAfterRelease(error, dispose)
    }
  }

  let active:
    | { branch: Awaited<ReturnType<typeof prepare>>; end: (replacement?: boolean) => Promise<void> }
    | undefined
  return {
    get current() {
      return active?.branch
    },
    async open(
      this: void,
      input: AppearancePreviewInput,
      read?: PrivateFontRead,
      options?: CallOptions,
    ): Promise<AppearancePreview> {
      options?.signal?.throwIfAborted()
      const number = ++generation
      const first = await prepare(input, read, options)
      if (number !== generation) {
        await first.dispose()
        throw new DesktopError('Cancelled', 'A newer preview was requested')
      }
      const ended = createSignal<void>()
      let revision = 0
      let releasing: Promise<void> | undefined
      const previous = active
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
        dispose: () => end(),
        onDispose(listener) {
          if (active === owned) {
            return ended.on(listener)
          }
          listener()
          return {
            dispose() {},
          }
        },
      }
    },
    async close() {
      generation++
      await active?.end()
    },
  }
}
