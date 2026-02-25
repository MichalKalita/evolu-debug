import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const require = createRequire(import.meta.url)
const cssInjectedByJsPlugin = require('vite-plugin-css-injected-by-js').default

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    cssInjectedByJsPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm', '@evolu/sqlite-wasm', '@evolu/web'],
  },
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'EvoluDebug',
      formats: ['iife'],
      fileName: () => 'evolu-debug.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  }
})
