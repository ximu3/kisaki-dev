// Generated only from the synthetic English ICU fixture.
interface MessageArguments {
  'actions.save': {}
  'actions.cancel': {}
  'actions.remove': {}
  'actions.delete': {}
  'actions.browse': {}
  'library.entities.game': {}
  'library.entities.anime': {}
  'library.entities.comic': {}
  'library.entities.novel': {}
  'library.entities.character': {}
  'library.entities.person': {}
  'library.entities.organization': {}
  'library.collection': {}
  'library.favorite': {}
  'library.metadataProfile': {}
  'library.added': { name: string | number }
  'library.kind': { kind: string }
  'records.setStatus': {}
  'records.recordCurrent': {}
  'records.history': {}
  'records.addPast': {}
  'records.unknownDate': {}
  'records.active.game': {}
  'records.active.anime': {}
  'records.active.comic': {}
  'records.active.novel': {}
  'records.running': {}
  'records.additionalDuration': {}
  'records.completionCount': { count: number }
  'selection.count': { count: number }
  'selection.position': { position: number }
  'selection.shared': { name: string | number; count: number }
  'feedback.updated': { when: Date | number }
  'feedback.retry': { name: string | number }
  'feedback.value': { value: string | number }
  'feedback.escaped': {}
  'feedback.literalMarkup': { name: string | number }
}
type MessageKey = keyof MessageArguments
type MessageCall = {
  [K in MessageKey]: keyof MessageArguments[K] extends never
    ? [key: K]
    : [key: K, values: MessageArguments[K]]
}[MessageKey]
declare function t(...args: MessageCall): string
t('actions.save')
t('selection.count', { count: 2 })
t('library.kind', { kind: 'future-value' })
t('feedback.updated', { when: new Date() })
t('feedback.updated', { when: 1792238400000 })
// @ts-expect-error This call violates the generated baseline contract.
t('actions')
// @ts-expect-error This call violates the generated baseline contract.
t('unknown.key')
// @ts-expect-error This call violates the generated baseline contract.
t('selection.count')
// @ts-expect-error This call violates the generated baseline contract.
t('selection.count', { count: '2' })
// @ts-expect-error This call violates the generated baseline contract.
t('feedback.updated', { when: 'yesterday' })
// @ts-expect-error This call violates the generated baseline contract.
t('actions.save', { name: 'extra' })
declare const uncertainKey: 'selection.count' | 'library.added'
declare const uncertainArguments: { count: number } | { name: string }
// @ts-expect-error Independent unions cannot prove key-to-argument correlation.
t(uncertainKey, uncertainArguments)
