import type { Evolu, EvoluSchema } from '@evolu/common'
import { afterEach, describe, expect, it } from 'vitest'
import evoluDebug from '../main'

const SHADOW_ROOT_KEY = '__EVOLU_DEBUG_SHADOW_ROOT__'
const APPLY_CSS_KEY = '__EVOLU_DEBUG_APPLY_CSS__'

const mountDebug = () => {
  evoluDebug({} as unknown as Evolu<EvoluSchema>, {} as EvoluSchema)
}

afterEach(() => {
  document.getElementById('evolu-debug-root')?.remove()
  delete (globalThis as Record<string, unknown>)[SHADOW_ROOT_KEY]
  delete (globalThis as Record<string, unknown>)[APPLY_CSS_KEY]
})

describe('evoluDebug bootstrap', () => {
  it('mounts app into a shadow root host', () => {
    mountDebug()

    const host = document.getElementById('evolu-debug-root')
    expect(host).toBeTruthy()
    expect(host?.shadowRoot).toBeTruthy()
    expect(host?.shadowRoot?.querySelector('button.floating-button')).toBeTruthy()
  })

  it('applies plugin-provided CSS through runtime hook', () => {
    ;(globalThis as Record<string, unknown>)[APPLY_CSS_KEY] = (shadowRoot: ShadowRoot) => {
      const styleTag = document.createElement('style')
      styleTag.id = 'evolu-debug-style'
      styleTag.textContent = '.floating-button{background:rgb(255,0,0);}'
      shadowRoot.appendChild(styleTag)
    }

    mountDebug()

    const host = document.getElementById('evolu-debug-root')
    const shadowStyle = host?.shadowRoot?.querySelector('#evolu-debug-style')

    expect(shadowStyle).toBeTruthy()
    expect(shadowStyle?.textContent).toContain('.floating-button')
  })

  it('replaces existing host on repeated bootstrap', () => {
    mountDebug()
    mountDebug()

    expect(document.querySelectorAll('#evolu-debug-root')).toHaveLength(1)
  })

  it('does not inject styles into document head by default', () => {
    mountDebug()

    expect(document.head.querySelector('#evolu-debug-style')).toBeNull()
  })
})
