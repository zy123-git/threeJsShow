import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import router, { fallbackToLastGoodPage } from './router';
import { hidePageLoadingNow } from './utils/pageLoading';
import './css/main.css';

// WebGL 上下文丢失：当前场景已无法继续渲染，回退到上一个成功页面
document.addEventListener(
  'webglcontextlost',
  (event) => {
    const target = event.target as HTMLCanvasElement | null;
    if (!target || !target.closest('.scene-stage')) return;

    event.preventDefault();
    console.warn('[page] WebGL 上下文丢失，已回退');
    hidePageLoadingNow();
    fallbackToLastGoodPage();
  },
  true
);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(ElementPlus);
app.use(router);
app.mount('#app');
