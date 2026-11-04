/** @fileoverview Verifies extract behavior using isolated synthetic inputs. */

import { createTranslator } from '@kisaki3/desktop-localization'

import { test, expect } from 'vitest'
import { getClueExtractionPresets } from './presets'
import { parseClueExtractionRule } from '@kisaki3/desktop-contracts/scanner'
import { extractWorkClues } from './extract'

test('scanner presets remain opt-in single-pass rules', () => {
  const examples = [
    '[A] Name [B]',
    '[A] [B] Name',
    'Name (2004)',
    'Name_v1.2',
    'Name_JP',
    '[A] Name',
    '(A) Name',
    'Name [B]',
    'Name (B)',
  ]
  const presets = getClueExtractionPresets(createTranslator('en'))
  for (const [index, preset] of presets.entries()) {
    const rule = parseClueExtractionRule({
      ...preset.rule,
      id: preset.id,
      name: String(preset.name),
    })

    const result = extractWorkClues([rule], {
      baseName: examples[index]!,
      relativePath: examples[index]!,
    })

    expect(result.clues.name).toBe('Name')
    expect(result.ruleId).toBe(preset.id)
  }

  expect(
    extractWorkClues([], { baseName: 'Original_name', relativePath: 'dir/Original_name' }).clues,
  ).toEqual({ name: 'Original_name' })
})
