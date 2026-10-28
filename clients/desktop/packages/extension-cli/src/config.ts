/**
 * @fileoverview Declares extension build inputs without starting builds or loading
 * extension code.
 */

/** Source inputs for one extension. Paths are relative to the extension project. */
export interface ExtensionBuildConfig {
  /** Node activation source, compiled without executing it. */
  entry: string
  /** Named HTML inputs, independent of runtime Webview registration. */
  webviews?: Record<string, string>
  /** Files or directories copied into the extension's complete runtime layout. */
  resources?: string[]
  /** Complete runtime output directory; defaults to out. */
  outDir?: string
}

/** Preserve a typed build declaration without I/O or starting an author workflow. */
export function defineConfig(config: ExtensionBuildConfig): ExtensionBuildConfig {
  return config
}
