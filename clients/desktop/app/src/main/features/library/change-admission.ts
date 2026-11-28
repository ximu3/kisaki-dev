import type { FileWorkType, PartType, WorkType } from '@kisaki3/desktop-contracts/library'

export type UseTarget =
  | { readonly type: 'work' | 'activity'; readonly kind: WorkType; readonly id: string }
  | { readonly type: 'file'; readonly kind: FileWorkType; readonly id: string }
  | { readonly type: 'part'; readonly kind: PartType; readonly id: string }
  | { readonly type: 'configuration'; readonly kind: 'game'; readonly id: string }

export type ChangeAdmission = <T>(
  targets: readonly UseTarget[],
  commit: () => Promise<T>,
) => Promise<T>
