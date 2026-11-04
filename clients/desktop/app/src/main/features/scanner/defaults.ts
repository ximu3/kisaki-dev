/** @fileoverview Creates opt-in scan definitions without silently enabling presets or recognizers. */

import type { NonEmptyArray } from '@kisaki3/desktop-contracts/operations'
import type { ScanDefinition } from '@kisaki3/desktop-contracts/scanner'
import { parseScanDefinitionShape } from '@kisaki3/desktop-contracts/scanner'

/** Default depth/filter/rule values require the caller's explicit input-kind choice; presets are never auto-enabled. */
export function getScanDefinitionDefaults(
  inputKinds: NonEmptyArray<'directory' | 'file'>,
): ScanDefinition {
  return parseScanDefinitionShape({
    entryDepth: 1,
    inputKinds,
    include: [],
    exclude: [],
    identification: { rules: [], recognizerIds: [] },
  })
}
