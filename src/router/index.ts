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
  {
    path: '/html-book',
    name: 'HTMLBook',
    component: () => import('../views/HTMLBook.vue'),
  },
  {
    path: '/html-sea',
    name: 'HTMLSea',
    component: () => import('../views/HTMLSea.vue'),
  },
  {
    path: '/html-forest',
    name: 'HTMLForest',
    component: () => import('../views/HTMLForest.vue'),
  },
  {
    path: '/html-fireworks',
    name: 'HTMLFireworks',
    component: () => import('../views/HTMLFireworks.vue'),
  },
  {
    path: '/html-classroom',
    name: 'HTMLClassroom',
    component: () => import('../views/HTMLClassroom.vue'),
  },
  {
    path: '/html-particles',
    name: 'HTMLParticles',
    component: () => import('../views/HTMLParticles.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
