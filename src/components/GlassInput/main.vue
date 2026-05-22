<script setup lang="ts">
import { ref } from "vue";
import { useMouseGradient } from "../../composables/useMouseGradient";

const modelValue = defineModel<string | number>({ default: "" });

defineProps<{
  placeholder?: string;
  clearable?: boolean;
  type?: string;
}>();

defineEmits<{
  clear: [];
  blur: [e: FocusEvent];
  keydown: [e: KeyboardEvent];
  keypress: [e: KeyboardEvent];
  keyup: [e: KeyboardEvent];
  focus: [e: FocusEvent];
  input: [e: Event];
  change: [e: Event];
}>();

defineOptions({ inheritAttrs: false });

const focused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);

const { onMouseMove: onInputMouseMove, onMouseLeave: onInputMouseLeave } = useMouseGradient(wrapperRef, {
  radius: 200,
  opacity: 0.12,
});

function focus() {
  inputRef.value?.focus();
}

function blur() {
  inputRef.value?.blur();
}

defineExpose({ focus, blur, inputRef });
</script>

<template>
  <div
    ref="wrapperRef"
    class="glass-input"
    :class="{ focused }"
    @mousemove="onInputMouseMove"
    @mouseleave="onInputMouseLeave"
  >
    <span v-if="$slots.prefix" class="glass-input-prefix">
      <slot name="prefix" />
    </span>
    <input
      ref="inputRef"
      v-bind="$attrs"
      v-model="modelValue"
      :type="type || 'text'"
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
