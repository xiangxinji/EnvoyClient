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
      <span class="glass-select-value">{{ currentLabel || props.placeholder }}</span>
      <SvgIcon name="chevron-down" :size="14" class="arrow" />
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
import SvgIcon from "../SvgIcon"

const props = withDefaults(defineProps<{
  modelValue?: string
  disabled?: boolean
  placeholder?: string
}>(), {
  placeholder: '',
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
@import './styles.css';
</style>
