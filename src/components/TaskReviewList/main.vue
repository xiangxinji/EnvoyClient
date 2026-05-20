<script setup lang="ts">
import type { TypedTaskResource } from "../../composables/useTaskResources";
import type { LeaderReviewData } from "../../types";
import { getResultText } from "../../utils/taskFormatters";
import { renderMarkdown } from "../../utils/markdown";
import SvgIcon from "../SvgIcon";

defineProps<{
  reviews: TypedTaskResource<LeaderReviewData>[];
}>();
</script>

<template>
  <div v-if="reviews.length > 0" class="task-section">
    <div class="section-label">
      <SvgIcon name="check-circle" :size="13" />
      {{ $t('task.reviewLog') }}
    </div>
    <div v-for="(review, i) in reviews" :key="`review-${i}`" class="review-item" :class="review.data?.success ? 'approved' : 'rejected'">
      <span class="resource-by">{{ review.by }}</span>
      <span class="review-status" :class="review.data?.success ? 'approved' : 'rejected'">
        {{ review.data?.success ? $t('task.approved') : $t('task.rejected') }}
      </span>
      <div v-if="review.data?.data" class="review-data">
        <div class="markdown-content" v-html="renderMarkdown(getResultText(review.data.data))" />
      </div>
      <div v-if="review.data?.error" class="review-error">{{ review.data.error }}</div>
    </div>
  </div>
</template>
