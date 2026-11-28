import { DesktopError } from '@kisaki3/desktop-contracts/errors'

import { createSignal } from './events'

export type UseTarget = {
  type: 'work' | 'part' | 'file' | 'configuration' | 'activity'
  kind: string
  id: string
}
export type ChangeAdmission = ReturnType<typeof createUseTargets>['change']

export function createUseTargets() {
  const released = createSignal<UseTarget>()
  const active = new Map<string, number>(),
    pending = new Map<string, number>(),
    changing = new Set<string>()
  const keys = (targets: readonly UseTarget[]) =>
    new Set(targets.map((target) => JSON.stringify([target.type, target.kind, target.id])))
  function hold(targets: readonly UseTarget[], counts: Map<string, number>) {
    const held = keys(targets)
    for (const key of held) {
      if (changing.has(key)) {
        throw new DesktopError('Busy', 'This target is being changed')
      }
    }
    for (const key of held) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return {
      dispose() {
        for (const key of held) {
          const remaining = counts.get(key)! - 1
          if (remaining) {
            counts.set(key, remaining)
          } else {
            counts.delete(key)
          }
        }
        for (const target of targets) {
          const [key] = keys([target])
          if (held.has(key!) && !active.has(key!) && !pending.has(key!)) {
            released.emit(target)
          }
        }
        held.clear()
      },
    }
  }
  async function change<T>(targets: readonly UseTarget[], commit: () => Promise<T>) {
    const held = keys(targets)
    for (const key of held) {
      if (pending.has(key)) {
        throw new DesktopError('PendingRecording', 'An unsaved recording refers to this target')
      }
      if (active.has(key)) {
        throw new DesktopError('InUse', 'This target is in use')
      }
      if (changing.has(key)) {
        throw new DesktopError('Busy', 'This target is being changed')
      }
    }
    for (const key of held) {
      changing.add(key)
    }
    try {
      return await commit()
    } finally {
      for (const key of held) {
        changing.delete(key)
      }
    }
  }
  return {
    onReleased: released.on,
    active: (targets: readonly UseTarget[]) => hold(targets, active),
    pending: (targets: readonly UseTarget[]) => hold(targets, pending),
    change,
  }
}
