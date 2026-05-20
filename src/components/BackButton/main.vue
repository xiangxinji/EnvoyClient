<template>
  <button class="back-btn" @click="$emit('click')">
    <SvgIcon name="chevron-left" :size="16" />
    {{ $t('common.back') }}
  </button>
</template>

<script setup lang="ts">
import SvgIcon from "../SvgIcon";

defineEmits<{
  click: []
}>()
</script>

<style scoped>
@import './styles.css';
</style>
