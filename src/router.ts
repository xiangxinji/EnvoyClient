import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: () => import("./views/RoleSelect") },
    { path: "/settings", component: () => import("./views/LoginSettings") },
    { path: "/chat", component: () => import("./views/ChatView") },
    { path: "/screenshot", component: () => import("./views/ScreenshotCapture.vue") },
  ],
});
