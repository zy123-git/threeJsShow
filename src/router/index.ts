import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/home.vue'),
  },
  {
    path: '/html-galaxy',
    name: 'HTMLGalaxy',
    component: () => import('../views/HTMLGalaxy.vue'),
  },
  {
    path: '/html-scroll',
    name: 'HTMLScroll',
    component: () => import('../views/HTMLScroll.vue'),
  },
  {
    path: '/html-model',
    name: 'HTMLModel',
    component: () => import('../views/HTMLModel.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
