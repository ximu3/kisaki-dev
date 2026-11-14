import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    minify: false,
    lib: {
      entry: 'src/extension-host/entry.ts',
      formats: ['es'],
      /** Keeps the compiled Node program at its declared runtime entry name. */
      fileName: () => 'entry.js',
    },
    rolldownOptions: { external: [/^node:/] },
  },
  ssr: { target: 'node', noExternal: true },
})
