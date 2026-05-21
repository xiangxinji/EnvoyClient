import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";
import { MotionPlugin } from "@vueuse/motion";

createApp(App).use(router).use(i18n).use(MotionPlugin).mount("#app");
