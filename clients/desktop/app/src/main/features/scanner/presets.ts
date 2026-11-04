/** @fileoverview Provides the nine native extraction templates with effective translated labels. */

import type { Translate } from '@kisaki3/desktop-localization'
import type { ClueExtractionPreset } from '@kisaki3/desktop-contracts/scanner'

/** Return the nine opt-in native templates in catalog order. Consumers assign fresh rule IDs and localized editable names. */
export function getClueExtractionPresets(t: Translate): readonly ClueExtractionPreset[] {
  const patterns = [
    [
      'bracket-both',
      'bracketBoth',
      String.raw`^(?:(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)[\t\p{Zs}]*)+(?<name>(?![\[【])\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)$`,
    ],
    [
      'multi-bracket-prefix',
      'multiBracketPrefix',
      String.raw`^(?:(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)[\t\p{Zs}]*){2,}(?<name>(?![\[【])\S[^\r\n\u2028\u2029]*)$`,
    ],
    [
      'release-year-suffix',
      'releaseYearSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?=\([0-9]{4}\)$|（[0-9]{4}）$)[(（](?<year>[0-9]{4})[)）]$`,
    ],
    [
      'version-suffix',
      'versionSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)_v[0-9]+(?:\.[0-9]+)*$`,
    ],
    [
      'lang-suffix',
      'languageSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[-_](?:CHS|CHT|JP|EN|KR|SC|TC)$`,
    ],
    [
      'bracket-prefix',
      'bracketPrefix',
      String.raw`^(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)[\t\p{Zs}]*(?<name>\S[^\r\n\u2028\u2029]*)$`,
    ],
    [
      'paren-prefix',
      'parenPrefix',
      String.raw`^(?:\([^()（）\r\n\u2028\u2029]+\)|（[^()（）\r\n\u2028\u2029]+）)[\t\p{Zs}]*(?<name>\S[^\r\n\u2028\u2029]*)$`,
    ],
    [
      'bracket-suffix',
      'bracketSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)$`,
    ],
    [
      'paren-suffix',
      'parenSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?:\([^()（）\r\n\u2028\u2029]+\)|（[^()（）\r\n\u2028\u2029]+）)$`,
    ],
  ] as const

  return patterns.map(([id, label, pattern]) => ({
    id,
    name: t(`scanner.presets.${label}.name`),
    description: t(`scanner.presets.${label}.description`),
    rule: {
      enabled: true,
      input: 'baseName',
      pattern,
      ignoreCase: id === 'version-suffix' || id === 'lang-suffix',
      output:
        id === 'release-year-suffix'
          ? { name: '$<name>', releaseDate: { year: '$<year>' } }
          : { name: '$<name>' },
    },
  }))
}
