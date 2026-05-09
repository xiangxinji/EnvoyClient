import { createRouter, createWebHashHistory } from "vue-router";
import RoleSelect from "./views/RoleSelect.vue";
import ChatView from "./views/ChatView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: RoleSelect },
    { path: "/chat", component: ChatView },
  ],
});
