import { reactive } from 'vue';

/**
 * 统一加载遮罩状态
 * - 路由段：组件 chunk 下载，进度在 0–40% 之间缓慢爬升
 * - 资源段：页面上报的 GLB / HDR 等资源进度，进度映射到 40–95%
 * - 收尾段：路由与资源都完成后快速走满并淡出
 */

export interface AssetToken {
  gen: number;
  ratio: number;
  ended: boolean;
}

export const pageLoading = reactive({
  visible: false,
  percent: 0,
  label: '场景',
  finishing: false,
});

// 资源令牌按“代”隔离：切换页面时旧页面的回调全部失效
let gen = 0;
const tokens = new Set<AssetToken>();

let routeReady = false;
let visibleAt = 0;
let tickTimer: number | null = null;
let graceTimer: number | null = null;
let timeoutTimer: number | null = null;
let hideTimer: number | null = null;

const MIN_VISIBLE = 500;
const MAX_WAIT = 15000;
const READY_GRACE = 400;

const clearTimer = (id: number | null) => {
  if (id !== null) window.clearTimeout(id);
};

const clearAllTimers = () => {
  if (tickTimer !== null) {
    window.clearInterval(tickTimer);
    tickTimer = null;
  }
  clearTimer(graceTimer);
  clearTimer(timeoutTimer);
  clearTimer(hideTimer);
  graceTimer = null;
  timeoutTimer = null;
  hideTimer = null;
};

const assetRatio = () => {
  if (!tokens.size) return 0;
  let sum = 0;
  tokens.forEach((token) => {
    sum += token.ratio;
  });
  return sum / tokens.size;
};

const targetPercent = () => {
  const elapsed = performance.now() - visibleAt;

  if (!routeReady) {
    // 路线段：4% 起步，渐近逼近 40%，避免长时间卡在同一个数字
    return 4 + 36 * (1 - Math.exp(-elapsed / 650));
  }

  const ratio = assetRatio();
  if (!tokens.size || ratio >= 1) return 96;

  return 40 + 55 * ratio;
};

const finish = () => {
  if (pageLoading.finishing || !pageLoading.visible) return;

  pageLoading.finishing = true;
  routeReady = true;

  const elapsed = performance.now() - visibleAt;
  const wait = Math.max(0, MIN_VISIBLE - elapsed);

  clearTimer(hideTimer);
  hideTimer = window.setTimeout(() => {
    pageLoading.percent = 100;
    hide();
  }, wait + 140);
};

const hide = () => {
  pageLoading.visible = false;
  pageLoading.finishing = false;
  pageLoading.percent = 0;
  clearAllTimers();
  tokens.clear();
};

const allAssetsEnded = () => {
  let done = true;
  tokens.forEach((token) => {
    if (!token.ended) done = false;
  });
  return done;
};

const checkIdle = () => {
  if (!routeReady || !pageLoading.visible || pageLoading.finishing) return;
  if (!tokens.size || allAssetsEnded()) finish();
};

const tick = () => {
  if (!pageLoading.visible) return;

  const target = pageLoading.finishing ? 100 : targetPercent();
  const next = pageLoading.percent + (target - pageLoading.percent) * 0.2;
  pageLoading.percent = Math.min(100, next);
};

const startTicker = () => {
  if (tickTimer !== null) return;
  tickTimer = window.setInterval(tick, 60);
};

/** 路由开始切换：显示遮罩并重置所有状态 */
export const beginPageLoading = (label = '场景') => {
  gen += 1;
  tokens.clear();
  routeReady = false;

  clearAllTimers();

  pageLoading.label = label;
  pageLoading.percent = 6;
  pageLoading.finishing = false;
  pageLoading.visible = true;
  visibleAt = performance.now();

  startTicker();
  timeoutTimer = window.setTimeout(finish, MAX_WAIT);
};

/** 路由组件已就绪（chunk 已加载完），等待页面资源进度 */
export const markRouteReady = () => {
  if (!pageLoading.visible || pageLoading.finishing) return;

  routeReady = true;

  clearTimer(graceTimer);
  graceTimer = window.setTimeout(checkIdle, READY_GRACE);
};

/** 路由失败：直接收尾，避免遮罩永久停留 */
export const failPageLoading = () => {
  if (pageLoading.visible) finish();
};

/** 失败回退：立即隐藏遮罩，不走最短展示与淡出，避免回退时二次闪烁 */
export const hidePageLoadingNow = () => {
  hide();
  routeReady = false;
};

/** 页面开始加载一个资源，返回用于上报进度的令牌 */
export const beginAssetLoading = (): AssetToken => {
  const token: AssetToken = { gen, ratio: 0, ended: false };
  tokens.add(token);
  return token;
};

export const reportAssetProgress = (
  token: AssetToken | null | undefined,
  loaded: number,
  total: number
) => {
  if (!token || token.gen !== gen || token.ended) return;
  if (!Number.isFinite(total) || total <= 0) return;

  token.ratio = Math.max(token.ratio, Math.min(1, loaded / total));
};

export const endAssetLoading = (token: AssetToken | null | undefined) => {
  if (!token || token.gen !== gen) return;

  token.ratio = 1;
  token.ended = true;

  if (!routeReady) return;

  clearTimer(graceTimer);
  graceTimer = window.setTimeout(checkIdle, 260);
};
