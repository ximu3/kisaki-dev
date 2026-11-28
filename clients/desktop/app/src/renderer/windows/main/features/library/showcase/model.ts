import { resolveLocalizedText } from '@kisaki3/extension-distribution/metadata'
import {
  workTypes,
  type ShowcaseFields,
  type ShowcasePreset,
  type ShowcaseSection,
} from '@kisaki3/desktop-contracts/library'
import { browseQuery } from '../../../domain-ui/library/query'

export function initialSection(): ShowcaseFields {
  return {
    name: '',
    query: { kind: 'entry', ...browseQuery({ type: 'library' }, workTypes), referenceLabels: [] },
    layout: 'horizontal',
    itemSize: 'md',
    openMode: 'page',
    limit: 12,
    isVisible: true,
  }
}
export function presetChoices(presets: readonly ShowcasePreset[], locale: string) {
  return presets.map((preset) => ({
    id: preset.id,
    name: resolveLocalizedText(preset.name, locale, preset.defaultLocale),
    description: resolveLocalizedText(preset.description, locale, preset.defaultLocale),
    preset,
  }))
}

export interface SectionEdit {
  saved?: ShowcaseSection
}
