import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "./views/Dashboard.vue";
import Teams from "./views/Teams.vue";
import TeamDetail from "./views/TeamDetail.vue";
import Users from "./views/Users.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Dashboard },
    { path: "/teams", component: Teams },
    { path: "/teams/:name", component: TeamDetail, props: true },
    { path: "/users", component: Users },
  ],
});
