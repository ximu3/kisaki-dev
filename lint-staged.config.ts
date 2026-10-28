/**
 * @fileoverview Selects formatting and lint checks for staged source and configuration
 * files.
 */

export default {
  '*.{ts,tsx}': ['prettier --check', 'eslint --max-warnings 0 --no-warn-ignored'],
  '*.{json,yaml,yml,css,html,md}': ['prettier --check'],
}
