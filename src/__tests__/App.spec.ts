import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('opens and closes debug shell', async () => {
    const wrapper = shallowMount(App)

    expect(wrapper.find('.debug-shell').exists()).toBe(false)
    expect(wrapper.get('button.floating-button').text()).toContain('Open Evolu Debug')

    await wrapper.get('button.floating-button').trigger('click')

    expect(wrapper.find('.debug-shell').exists()).toBe(true)
    expect(wrapper.get('button.floating-button').text()).toContain('Close Evolu Debug')

    await wrapper.get('button.floating-button').trigger('click')

    expect(wrapper.find('.debug-shell').exists()).toBe(false)
  })
})
