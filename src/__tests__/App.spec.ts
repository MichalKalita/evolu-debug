import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

const TablesStub = defineComponent({
  name: 'Tables',
  emits: ['select-table', 'tables-loaded'],
  template: '<div class="tables-stub" />',
})

const TableDetailStub = defineComponent({
  name: 'TableDetail',
  props: {
    tableName: {
      type: String,
      required: true,
    },
  },
  template: '<div class="detail-stub">{{ tableName }}</div>',
})

const mountApp = () =>
  mount(App, {
    global: {
      stubs: {
        Tables: TablesStub,
        TableDetail: TableDetailStub,
      },
    },
  })

describe('App', () => {
  it('opens and closes debug shell', async () => {
    const wrapper = mountApp()

    expect(wrapper.find('.debug-shell').exists()).toBe(false)
    expect(wrapper.get('button.floating-button').text()).toContain('Open Evolu Debug')

    await wrapper.get('button.floating-button').trigger('click')

    expect(wrapper.find('.debug-shell').exists()).toBe(true)
    expect(wrapper.get('button.floating-button').text()).toContain('Close Evolu Debug')

    await wrapper.get('button.floating-button').trigger('click')

    expect(wrapper.find('.debug-shell').exists()).toBe(false)
  })

  it('selects first table from tables-loaded and switches detail by select-table', async () => {
    const wrapper = mountApp()

    await wrapper.get('button.floating-button').trigger('click')

    const tables = wrapper.getComponent(TablesStub)
    tables.vm.$emit('tables-loaded', ['todo', 'chatMessage'])
    await wrapper.vm.$nextTick()

    const detail = wrapper.getComponent(TableDetailStub)
    expect(detail.props('tableName')).toBe('todo')

    tables.vm.$emit('select-table', 'chatMessage')
    await wrapper.vm.$nextTick()

    expect(wrapper.getComponent(TableDetailStub).props('tableName')).toBe('chatMessage')
  })

  it('resets selected table when closed', async () => {
    const wrapper = mountApp()

    await wrapper.get('button.floating-button').trigger('click')
    const tables = wrapper.getComponent(TablesStub)

    tables.vm.$emit('tables-loaded', ['todo'])
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(TableDetailStub).exists()).toBe(true)

    await wrapper.get('button.floating-button').trigger('click')
    await wrapper.get('button.floating-button').trigger('click')

    expect(wrapper.findComponent(TableDetailStub).exists()).toBe(false)
  })
})
