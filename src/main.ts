import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { Evolu } from '@evolu/common'

export default function evoluDebug(_evolu: Evolu) {
    const app = createApp(App)
    app.use(createPinia())

    const mountNode = document.createElement('div')
    mountNode.id = 'evolu-debug-root'
    document.body.appendChild(mountNode)
    app.mount(mountNode)
}
