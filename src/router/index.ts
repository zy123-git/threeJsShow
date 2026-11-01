import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { sceneRoutes } from '../config/scenes';
import {
  beginPageLoading,
  hidePageLoadingNow,
  markRouteReady,
} from '../utils/pageLoading';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    meta: { title: '首页' },
    component: () => import('../views/home.vue'),
  },
  ...sceneRoutes,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from) => {
  // 同路径重复导航：不重复弹出加载遮罩
  if (to.path === from.path && from.name !== undefined) return true;

  beginPageLoading((to.meta?.title as string) || '场景');
  return true;
});

// 成功访问过的页面轨迹：加载失败时回退到上一个成功页面
const trail: string[] = [];
let fallbacking = false;
let failureStreak = 0;

router.afterEach((to, _from, failure) => {
  if (!failure) {
    if (trail[trail.length - 1] !== to.fullPath) trail.push(to.fullPath);
    if (trail.length > 20) trail.shift();
    failureStreak = 0;
  }
  markRouteReady();
});

/** 页面级失败：回退到上一个成功页面（没有则回首页） */
export const fallbackToLastGoodPage = (failedPath?: string) => {
  if (fallbacking) return;

  const failed = failedPath ?? router.currentRoute.value.fullPath;
  // 挂载后才失败的页面已进入轨迹，先剔除，避免回退到失败页自身
  if (trail.length && trail[trail.length - 1] === failed) trail.pop();

  const target = trail.length ? trail[trail.length - 1] : '/';
  const initializing = router.currentRoute.value.matched.length === 0;

  // 上一页仍在展示（chunk 失败未提交导航），无需重复导航
  if (!initializing && target === router.currentRoute.value.fullPath) return;

  fallbacking = true;
  router.replace(target).finally(() => {
    fallbacking = false;
  });
};

router.onError((error, to) => {
  console.error('[page] 页面加载失败，已回退:', error);
  hidePageLoadingNow();

  // 连续失败保护：兜底页自身也失败时不再无限回退
  failureStreak += 1;
  if (failureStreak > 2) return;

  fallbackToLastGoodPage(to?.fullPath);
});

export default router;
