export function mergeText(kept: string | null, source: string | null) {
  return (
    [...new Set([kept, source].filter((s): s is string => s !== null && !!s.trim()))].join(
      '\n\n',
    ) || null
  )
}
