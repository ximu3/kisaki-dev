import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    minify: false,
    lib: {
      entry: 'src/main/entry.ts',
      formats: ['es'],
      /** Keeps the compiled Node program at its declared runtime entry name. */
      fileName: () => 'entry.js',
    },
    // Bundle the driver's JavaScript; initializeDatabase supplies the deployed nativeBinding path.
    rolldownOptions: { external: [/^node:/, 'electron'] },
  },
  ssr: { target: 'node', noExternal: true },
})
