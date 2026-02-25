import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const require = createRequire(import.meta.url)
const cssInjectedByJsPlugin = require('vite-plugin-css-injected-by-js').default

const EVOLU_DEBUG_STYLE_ID = 'evolu-debug-style'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    cssInjectedByJsPlugin({
      styleId: EVOLU_DEBUG_STYLE_ID,
      topExecutionPriority: false,
      injectCodeFunction: function injectCodeIntoShadowRoot(cssCode: string, options: { styleId?: string }) {
        try {
          const runtimeGlobal = globalThis as Record<string, unknown>
          const styleId =
            typeof options.styleId === 'string' && options.styleId.length > 0
              ? options.styleId
              : 'evolu-debug-style'

          const applyCssToShadowRoot = (shadowRoot: ShadowRoot) => {
            shadowRoot.querySelector(`#${styleId}`)?.remove()

            const styleTag = document.createElement('style')
            styleTag.id = styleId
            styleTag.appendChild(document.createTextNode(cssCode))
            shadowRoot.appendChild(styleTag)
          }

          runtimeGlobal.__EVOLU_DEBUG_APPLY_CSS__ = applyCssToShadowRoot

          const maybeShadowRoot = runtimeGlobal.__EVOLU_DEBUG_SHADOW_ROOT__
          if (maybeShadowRoot instanceof ShadowRoot) {
            applyCssToShadowRoot(maybeShadowRoot)
          }
        } catch (error) {
          console.error('vite-plugin-css-injected-by-js', error)
        }
      },
    }),
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
      formats: ['es'],
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
