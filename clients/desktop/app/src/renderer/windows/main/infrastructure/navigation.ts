import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type {
  DialogPresentation,
  DialogReceipt,
} from '../../../infrastructure/dialogs/presentation'

export interface NavigableDialog extends DialogPresentation {
  receipt: DialogReceipt
  onNavigate: (handler: (target: NativeViewTarget, signal: AbortSignal) => Promise<boolean>) => void
}
