import type {
  FileWorkType,
  FileRecognitionProfilesApi,
  FileRecognitionProfile,
  FileRecognitionPreset,
} from '@kisaki3/desktop-contracts/library'
import type { createProfiles } from './profiles'

export function profileCatalog<T extends FileWorkType>(
  type: T,
  profiles: ReturnType<typeof createProfiles>,
): FileRecognitionProfilesApi<T> {
  const signal = (s?: AbortSignal) => s ?? new AbortController().signal
  return {
    list: async () =>
      (await profiles.list(type)) as Pick<
        FileRecognitionProfile<T>,
        'id' | 'workType' | 'name' | 'description'
      >[],
    get: async (id) => (await profiles.get(type, id)) as FileRecognitionProfile<T> | null,
    references: async (id) =>
      (await profiles.references(type, id)).map((row) => ({
        ...row,
        work: { type, id: row.work.id },
      })),
    listPresets: async () => profiles.presets(type) as FileRecognitionPreset<T>[],
    create: async (input, call) =>
      (await profiles.create(type, input, signal(call?.signal))) as FileRecognitionProfile<T>,
    update: async (id, input, call) =>
      (await profiles.update(type, id, input, signal(call?.signal))) as FileRecognitionProfile<T>,
    delete: (id, call) => profiles.delete(type, id, signal(call?.signal)),
    reorder: (input, call) => profiles.reorder(type, input, signal(call?.signal)),
  }
}
