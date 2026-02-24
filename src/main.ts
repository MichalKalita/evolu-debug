import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { Evolu, EvoluSchema } from '@evolu/common'

export default function evoluDebug(evolu: Evolu, schema: EvoluSchema) {
    const app = createApp(App)
    app.use(createPinia())
    app.config.globalProperties.$evolu = evolu
    app.config.globalProperties.$schema = schema
    app.provide('evolu', evolu)
    app.provide('schema', schema)

    const mountNode = document.createElement('div')
    mountNode.id = 'evolu-debug-root'
    document.body.appendChild(mountNode)
    app.mount(mountNode)
}
