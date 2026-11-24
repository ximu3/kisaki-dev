import { createHash } from 'node:crypto'
import type { ThemeFontResourceFile, ViewFontFace } from '@kisaki3/desktop-contracts/appearance'
import type { FontMetricRange } from '@kisaki3/desktop-contracts/fonts'
import type { ReadResourceRef, ViewResourcesApi } from '@kisaki3/desktop-contracts/resources'

function range(value: FontMetricRange, unit = '') {
  return value.min + unit + (value.min === value.max ? '' : ' ' + value.max + unit)
}

export function createDocumentFonts(
  view: ViewResourcesApi,
  digest: (ref: ReadResourceRef) => string,
) {
  async function bind(files: readonly ThemeFontResourceFile[], family: string) {
    const binding = await view.bind(
      Object.fromEntries(files.map((file, i) => [String(i), file.resource])),
    )
    const faces: ViewFontFace[] = files.flatMap((file, index) =>
      file.metadata.faces.map((face) => ({
        family,
        url: binding.urls[String(index)]!,
        descriptors: {
          weight: range(face.weight),
          stretch: range(face.width, '%'),
          style: face.style,
        },
      })),
    )
    return { faces, dispose: () => binding.dispose() }
  }

  const entries = new Map<string, { readers: number; bound: ReturnType<typeof bind> }>()
  return async (files: readonly ThemeFontResourceFile[]) => {
    const hash = createHash('sha256')
    for (const file of files) {
      hash.update(digest(file.resource))
    }
    const family = 'Kisaki-' + hash.digest('hex')
    let entry = entries.get(family)
    if (!entry) {
      entry = { readers: 0, bound: bind(files, family) }
      entries.set(family, entry)
    }
    const owned = entry
    owned.readers++
    try {
      const bound = await owned.bound
      let released = false
      return {
        family,
        faces: bound.faces,
        async dispose() {
          if (released) {
            return
          }
          released = true
          if (--owned.readers === 0) {
            entries.delete(family)
            await bound.dispose()
          }
        },
      }
    } catch (error) {
      if (entries.get(family) === owned) {
        entries.delete(family)
      }
      throw error
    }
  }
}
