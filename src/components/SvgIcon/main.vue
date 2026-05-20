<script setup lang="ts">
import { computed } from "vue";
import { getIcon } from "../../assets/icons";

const props = withDefaults(defineProps<{
  name: string;
  size?: number | string;
}>(), {
  size: 16,
});

const iconSvg = computed(() => getIcon(props.name));

const sizeValue = computed(() =>
  typeof props.size === "number" ? `${props.size}px` : props.size
);
</script>

<template>
  <span class="svg-icon" :style="{ width: sizeValue, height: sizeValue }" v-html="iconSvg" />
</template>

<style scoped>
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}
.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
