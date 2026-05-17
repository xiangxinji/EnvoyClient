import { createRouter, createWebHashHistory } from "vue-router";
import WelcomePage from "./views/WelcomePage.vue";
import PathPage from "./views/PathPage.vue";
import InstallingPage from "./views/InstallingPage.vue";
import CompletePage from "./views/CompletePage.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/welcome" },
    { path: "/welcome", component: WelcomePage },
    { path: "/path", component: PathPage },
    { path: "/installing", component: InstallingPage },
    { path: "/complete", component: CompletePage },
  ],
});

export default router;
