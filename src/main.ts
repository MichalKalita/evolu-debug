import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { Evolu, EvoluSchema } from '@evolu/common'
import { EvoluContext } from '@evolu/vue'
import { EvoluDebugSchemaContext } from './context'

const SHADOW_ROOT_KEY = '__EVOLU_DEBUG_SHADOW_ROOT__'
const APPLY_CSS_KEY = '__EVOLU_DEBUG_APPLY_CSS__'

const runtimeGlobal = (): Record<string, unknown> => globalThis as unknown as Record<string, unknown>

const applyCssToShadowRoot = (shadowRoot: ShadowRoot) => {
  runtimeGlobal()[SHADOW_ROOT_KEY] = shadowRoot

  const applyCss = runtimeGlobal()[APPLY_CSS_KEY]
  if (typeof applyCss === 'function') {
    ;(applyCss as (shadowRoot: ShadowRoot) => void)(shadowRoot)
  }
}

export default function evoluDebug<Schema extends EvoluSchema>(evolu: Evolu<Schema>, schema: Schema) {
  const existingRoot = document.getElementById('evolu-debug-root')
  if (existingRoot) {
    existingRoot.remove()
  }

  const app = createApp(App)
  app.use(createPinia())
  app.config.globalProperties.$evolu = evolu
  app.config.globalProperties.$schema = schema
  app.provide(EvoluContext, evolu)
  app.provide(EvoluDebugSchemaContext, schema)

  const hostNode = document.createElement('div')
  hostNode.id = 'evolu-debug-root'
  const shadowRoot = hostNode.attachShadow({ mode: 'open' })

  const shadowReset = document.createElement('style')
  shadowReset.textContent = `
    :host {
      all: initial;
      contain: layout style paint;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }
  `
  shadowRoot.appendChild(shadowReset)
  applyCssToShadowRoot(shadowRoot)

  const mountNode = document.createElement('div')
  shadowRoot.appendChild(mountNode)

  document.body.appendChild(hostNode)
  app.mount(mountNode)
}
