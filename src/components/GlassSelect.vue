<template>
  <div ref="containerRef" class="glass-select" :class="{ disabled, open }">
    <button
      type="button"
      class="glass-select-trigger"
      :disabled="disabled"
      @click="toggle"
      @keydown.down.prevent="openList(0)"
      @keydown.up.prevent="openList(options.length - 1)"
      @keydown.escape="close"
    >
      <span class="glass-select-value">{{ currentLabel || placeholder }}</span>
      <svg class="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="open" class="glass-select-dropdown">
        <div
          v-for="(opt, i) in options"
          :key="opt.value"
          class="glass-select-option"
          :class="{ active: opt.value === modelValue, focused: i === focusIndex }"
          @click="select(opt.value)"
          @mouseenter="focusIndex = i"
        >
          {{ opt.label }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, useSlots } from "vue"

const props = withDefaults(defineProps<{
  modelValue?: string
  disabled?: boolean
  placeholder?: string
}>(), {
  placeholder: '请选择',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const slots = useSlots()
const containerRef = ref<HTMLElement>()
const open = ref(false)
const focusIndex = ref(-1)

interface SelectOption {
  value: string
  label: string
}

const options = computed<SelectOption[]>(() => {
  // Support both <option> slot and :options prop
  if (props.modelValue !== undefined) {
    // Try parsing from slot VNodes
    const children = slots.default?.() ?? []
    const result: SelectOption[] = []
    for (const child of children) {
      if (child.type === 'option' && child.props) {
        const value = String(child.props.value ?? '')
        const label = String(child.children ?? value)
        result.push({ value, label })
      }
    }
    return result
  }
  return []
})

const currentLabel = computed(() => {
  const opt = options.value.find(o => o.value === props.modelValue)
  return opt?.label ?? props.modelValue ?? ''
})

function toggle() {
  if (props.disabled) return
  open.value ? close() : openList()
}

function openList(index?: number) {
  if (props.disabled) return
  open.value = true
  focusIndex.value = index ?? options.value.findIndex(o => o.value === props.modelValue)
}

function close() {
  open.value = false
  focusIndex.value = -1
}

function select(value: string) {
  emit('update:modelValue', value)
  close()
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    close()
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.glass-select {
  position: relative;
  width: 100%;
}

.glass-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 36px;
  box-sizing: border-box;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--text-primary);
  font-size: 0.9em;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  text-align: left;
  font-family: inherit;
}

.glass-select-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.glass-select-trigger:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.glass-select.open .glass-select-trigger {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.glass-select-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  padding-right: 20px;
}

.arrow {
  position: absolute;
  right: 12px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.glass-select.open .arrow {
  transform: rotate(180deg);
}

.glass-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow-heavy);
  padding: var(--space-xs);
}

.glass-select-option {
  padding: 9px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9em;
  color: var(--text-primary);
  transition: background 0.1s;
}

.glass-select-option:hover,
.glass-select-option.focused {
  background: var(--accent-light);
}

.glass-select-option.active {
  color: var(--accent);
  font-weight: 600;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
