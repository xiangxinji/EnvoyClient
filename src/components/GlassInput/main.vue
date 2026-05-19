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
@import './styles.css';
</style>
