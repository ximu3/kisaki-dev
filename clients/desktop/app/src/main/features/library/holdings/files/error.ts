import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'

export function fileError(cause: unknown): ErrorSummary {
  return {
    code: cause instanceof DesktopError ? cause.code : 'ReadFailed',
    message: cause instanceof Error ? cause.message : String(cause),
  }
}
