<script setup lang="ts">
const props = defineProps<{
  tableName: string
  selectedView: 'data' | 'schema' | 'insert'
  showInsertTab?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:selectedView', value: 'data' | 'schema' | 'insert'): void
}>()
</script>

<template>
  <h1>{{ props.tableName }}</h1>

  <div class="view-switch">
    <button
      type="button"
      :class="['switch-btn', { 'is-active': props.selectedView === 'data' }]"
      @click="emit('update:selectedView', 'data')"
    >
      Data
    </button>
    <button
      type="button"
      :class="['switch-btn', { 'is-active': props.selectedView === 'schema' }]"
      @click="emit('update:selectedView', 'schema')"
    >
      Schema
    </button>
    <button
      v-if="props.showInsertTab"
      type="button"
      :class="['switch-btn', { 'is-active': props.selectedView === 'insert' }]"
      @click="emit('update:selectedView', 'insert')"
    >
      Add Row
    </button>
  </div>
</template>

<style scoped>
h1 {
  margin: 0 0 10px;
  font-size: 16px;
}

.view-switch {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 10px;
}

.switch-btn {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  border-radius: 4px;
  padding: 5px 9px;
  cursor: pointer;
  font-size: 12px;
}

.switch-btn.is-active {
  background: #e0e7ff;
  color: #1d4ed8;
  border-color: #93c5fd;
}
</style>
