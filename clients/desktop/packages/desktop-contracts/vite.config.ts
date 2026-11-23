import { defineLibrary } from '@kisaki3/config/vite/library'
import manifest from './package.json' with { type: 'json' }

export default defineLibrary({
  manifest,
  generated: { task: 'generate:icon-names', command: 'vpx tools/generate-icon-names.ts' },
})
