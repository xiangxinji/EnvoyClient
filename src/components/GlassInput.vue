<script setup lang="ts">
import { ref } from "vue";

const modelValue = defineModel<string>({ default: "" });

defineProps<{
  placeholder?: string;
  clearable?: boolean;
}>();

defineEmits<{
  clear: [];
}>();

defineOptions({ inheritAttrs: false });

const focused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

function focus() {
  inputRef.value?.focus();
}

function blur() {
  inputRef.value?.blur();
}

defineExpose({ focus, blur, inputRef });
</script>

<template>
  <div class="glass-input" :class="{ focused }">
    <span v-if="$slots.prefix" class="glass-input-prefix">
      <slot name="prefix" />
    </span>
    <input
      ref="inputRef"
      v-bind="$attrs"
      v-model="modelValue"
      type="text"
      class="glass-input-field"
      :placeholder="placeholder"
      @focus="focused = true"
      @blur="focused = false"
    />
    <button
      v-if="clearable && modelValue"
      class="glass-input-clear"
      @click="modelValue = ''; $emit('clear')"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.glass-input {
  display: flex;
  align-items: center;
  height: 36px;
  box-sizing: border-box;
  padding: 0 14px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s;
  gap: 6px;
}

.glass-input.focused {
  border-color: var(--accent);
}

.glass-input-prefix {
  display: flex;
  align-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.glass-input-field {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.85em;
  height: 100%;
  min-width: 0;
}

.glass-input-field::placeholder {
  color: var(--text-muted);
}

.glass-input-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  font-size: 0.75em;
  flex-shrink: 0;
  transition: color 0.1s;
}

.glass-input-clear:hover {
  color: var(--text-secondary);
}
</style>
