import { build } from 'vite'
import solid from 'vite-plugin-solid'
await build({
  configFile: false,
  root: import.meta.dirname,
  base: './',
  plugins: [solid()],
  build: { outDir: 'out', emptyOutDir: false, minify: false }
})
