<script setup lang="ts">
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import LeaderNode from "./LeaderNode.vue";
import MemberNode from "./MemberNode.vue";
import { useTeamGraph } from "../../composables/useTeamGraph";
import { computed } from "vue";

const { graphData } = useTeamGraph();
const nodes = computed(() => graphData.value.nodes);
const edges = computed(() => graphData.value.edges);
</script>

<template>
  <div class="org-view">
    <div class="org-view-header">
      <span class="header-name">{{ $t('sidebar.orgStructure') }}</span>
    </div>
    <div class="org-view-flow">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ zoom: 1, x: 0, y: 0 }"
        :min-zoom="0.3"
        :max-zoom="1.5"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="false"
        :zoom-on-scroll="true"
        :pan-on-drag="true"
        fit-view-on-init
      >
        <template #node-leader="nodeProps">
          <LeaderNode :data="nodeProps.data" />
        </template>
        <template #node-member="nodeProps">
          <MemberNode :data="nodeProps.data" />
        </template>
        <Background :gap="20" :size="1" />
      </VueFlow>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
