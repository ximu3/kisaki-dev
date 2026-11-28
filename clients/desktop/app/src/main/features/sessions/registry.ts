import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { createSignal } from '../../infrastructure/events'
import type { ChangeAdmission, UseTarget } from '../library/change-admission'

export function createSessionRegistry() {
  const released = createSignal<UseTarget>()
  const active = new Map<string, number>(),
    pending = new Map<string, number>(),
    changing = new Set<string>()
  const keyOf = (target: UseTarget) => JSON.stringify([target.type, target.kind, target.id])
  function hold(targets: readonly UseTarget[], counts: Map<string, number>) {
    const held = new Map(targets.map((target) => [keyOf(target), target]))
    for (const key of held.keys()) {
      if (changing.has(key)) {
        throw new DesktopError('Busy', 'This target is being changed')
      }
    }
    for (const key of held.keys()) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return {
      dispose() {
        for (const key of held.keys()) {
          const remaining = counts.get(key)! - 1
          if (remaining) {
            counts.set(key, remaining)
          } else {
            counts.delete(key)
          }
        }
        for (const [key, target] of held) {
          if (!active.has(key) && !pending.has(key)) {
            released.emit(target)
          }
        }
        held.clear()
      },
    }
  }
  const change: ChangeAdmission = async (targets, commit) => {
    const held = new Set(targets.map(keyOf))
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
