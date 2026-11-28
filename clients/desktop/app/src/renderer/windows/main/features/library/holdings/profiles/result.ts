import type {
  FileConditionByType,
  FileRecognitionSource,
  FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
export function ruleSource(source: FileRecognitionSource | null, t: Translate) {
  if (!source) {
    return t('library.holdings.none')
  }
  if (source.type === 'builtin') {
    return t('library.holdings.builtin')
  }
  return [
    t(source.type === 'draft' ? 'library.holdings.draft' : 'library.holdings.profile'),
    source.ruleId,
  ].join(' · ')
}
export function conditionLabel(condition: FileConditionByType[FileWorkType], t: Translate) {
  const labels: string[] = [t(`library.ruleEditor.${condition.kind}`)]
  if ('episodeType' in condition && condition.episodeType) {
    labels.push(t(`library.ruleEditor.${condition.episodeType}`))
  }
  if ('extraType' in condition && condition.extraType) {
    labels.push(t(`library.ruleEditor.${condition.extraType}`))
  }
  if (condition.kind === 'chapter') {
    if (condition.volume) {
      labels.push(
        t('library.ruleEditor.volumeScope') +
          ' · ' +
          [condition.volume.number, condition.volume.name].filter(Boolean).join(' '),
      )
    }
    if (condition.numberBasis) {
      labels.push(t(`library.ruleEditor.${condition.numberBasis}`))
    }
  }
  if ('number' in condition && condition.number) {
    const number = condition.number
    labels.push(number.kind === 'range' ? number.start + ' – ' + number.end : number.value)
  }
  if (condition.name) {
    labels.push(condition.name)
  }
  return labels.join(' · ')
}
