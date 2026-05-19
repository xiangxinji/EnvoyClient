import { createRouter, createWebHashHistory } from "vue-router";
import RoleSelect from "./views/RoleSelect";
import ChatView from "./views/ChatView";
import LoginSettings from "./views/LoginSettings";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: RoleSelect },
    { path: "/settings", component: LoginSettings },
    { path: "/chat", component: ChatView },
  ],
});
