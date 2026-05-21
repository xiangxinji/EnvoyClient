<script setup lang="ts">
import SvgIcon from "../SvgIcon";

defineProps<{
  from: string;
  text: string;
  revoked?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <div class="quote-card" :class="{ revoked }" @click="emit('click')">
    <span class="quote-label"><SvgIcon name="reply" :size="12" /> {{ from }}</span>
    <span class="quote-text">{{ text }}</span>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
