<template>
  <div class="app-container">
    <!-- 悬浮玻璃侧栏 -->
    <el-aside
      class="glass-sidebar"
      :class="{ 'is-collapsed': isCollapse }"
      :width="isCollapse ? '76px' : '260px'"
    >
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="logo-row">
          <button
            class="logo-tile"
            type="button"
            :aria-expanded="!isCollapse"
            :aria-label="isCollapse ? '展开侧栏' : '收起侧栏'"
            @click="toggleCollapse"
          >
            <el-icon :size="18">
              <component :is="isCollapse ? Hide : View" />
            </el-icon>
          </button>
          <router-link to="/" class="brand">
            <span class="brand-name">3D 视界</span>
            <span class="micro brand-micro">VISUAL LAB</span>
          </router-link>
        </div>
      </div>

      <!-- 导航 -->
      <el-menu
        :default-active="activeRoute"
        :unique-opened="isCollapse"
        router
        @select="onMenuSelect"
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <template #title>
            <span class="nav-text">首页</span>
          </template>
        </el-menu-item>

        <el-sub-menu
          v-for="group in sceneGroups"
          :key="group.key"
          :index="group.key"
        >
          <template #title>
            <el-icon><component :is="group.icon" /></el-icon>
            <span class="nav-text">{{ group.title }}</span>
            <span class="nav-micro">{{ group.micro }}</span>
          </template>
          <el-menu-item
            v-for="scene in group.scenes"
            :key="scene.path"
            :index="scene.path"
          >
            <span v-if="isCollapse" class="nav-badge">{{ scene.title[0] }}</span>
            <span class="nav-text">{{ scene.title }}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>

      <!-- 主题色 -->
      <div class="theme-section">
        <el-popover placement="right-end" :width="340" trigger="click" @show="syncTempTheme">
          <template #reference>
            <button class="theme-button" type="button">
              <el-icon :size="15"><Brush /></el-icon>
              <span class="theme-label">主题</span>
            </button>
          </template>

          <div class="theme-picker">
            <div class="picker-head">
              <span class="micro">ACCENT</span>
              <span class="picker-hint">选择强调色</span>
            </div>

            <div class="theme-colors">
              <div
                v-for="(theme, index) in themes"
                :key="index"
                class="theme-color-wrapper"
                @click="changeTheme(theme)"
              >
                <div
                  class="theme-color"
                  :class="{ active: tempTheme.primary === theme.primary }"
                  :style="{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }"
                ></div>
                <span class="theme-color-name">{{ theme.name }}</span>
              </div>
            </div>

            <div class="picker-row">
              <span class="micro">CUSTOM</span>
              <el-color-picker v-model="customColor" @change="changeCustomTheme" size="small" />
            </div>

            <div class="picker-actions">
              <button class="pill picker-btn" type="button" @click="confirmTheme">应用</button>
              <button class="pill picker-btn ghost" type="button" @click="resetTheme">重置</button>
            </div>
          </div>
        </el-popover>
      </div>
    </el-aside>

    <main class="main-content">
      <router-view v-slot="{ Component, route: sceneRoute }">
        <SceneShell
          v-if="sceneRoute.meta.scene"
          :title="sceneTitle(sceneRoute)"
          micro="SCENE / THREE.JS"
        >
          <component :is="Component" :key="sceneRoute.path" />
        </SceneShell>
        <component :is="Component" v-else :key="sceneRoute.path" />
      </router-view>

      <PageLoading />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onErrorCaptured } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { House, View, Hide, Brush } from '@element-plus/icons-vue';
import { SCENE_GROUPS, SCENES } from './config/scenes';
import SceneShell from './components/SceneShell.vue';
import PageLoading from './components/PageLoading.vue';
import { fallbackToLastGoodPage } from './router';
import { hidePageLoadingNow } from './utils/pageLoading';

const route = useRoute();
const router = useRouter();

// 侧栏折叠状态持久化：刷新或页面失败重载后保持用户选择
const COLLAPSE_KEY = 'sidebarCollapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};
const isCollapse = ref(readCollapsed());

// 点击侧栏后立即高亮：路由切换完成前先用 pendingPath 乐观选中
const pendingPath = ref<string | null>(null);
const activeRoute = computed(() => pendingPath.value ?? route.path);

const onMenuSelect = (index: string) => {
  pendingPath.value = index === route.path ? null : index;
};

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
  try {
    localStorage.setItem(COLLAPSE_KEY, isCollapse.value ? '1' : '0');
  } catch {
    /* 存储不可用时忽略 */
  }
};

// 导航失败：清掉乐观选中，避免残留失败项的选中态
router.onError(() => {
  pendingPath.value = null;
});

// 场景组件挂载/渲染失败：回退到上一个成功页面
onErrorCaptured((error) => {
  if (!(error instanceof Error) || !route.meta?.scene) return;

  console.error('[page] 场景运行失败，已回退:', error);
  pendingPath.value = null;
  hidePageLoadingNow();
  fallbackToLastGoodPage(route.path);
  return false;
});

watch(
  () => route.path,
  (path) => {
    if (path === pendingPath.value) pendingPath.value = null;
  }
);

const sceneGroups = SCENE_GROUPS.map((group) => ({
  ...group,
  scenes: SCENES.filter((scene) => scene.group === group.key).sort(
    (a, b) => (a.navOrder ?? 9999) - (b.navOrder ?? 9999)
  ),
}));

const currentTheme = ref('#6e8bff');
const customColor = ref('#6e8bff');
const secondaryTheme = ref('#a56bff');

const sceneTitle = (r: { meta?: Record<string, unknown>; name?: unknown }) =>
  (r.meta?.title as string) || String(r.name || '场景');

const tempTheme = ref({ primary: currentTheme.value, secondary: secondaryTheme.value });

const themes = [
  { name: '星云蓝', primary: '#6e8bff', secondary: '#a56bff' },
  { name: '极光青', primary: '#37d2ff', secondary: '#6e8bff' },
  { name: '薄暮紫', primary: '#a56bff', secondary: '#ff7ac6' },
  { name: '深海蓝', primary: '#4facfe', secondary: '#00d4ff' },
  { name: '薄荷绿', primary: '#38ef7d', secondary: '#12b886' },
  { name: '暖阳橙', primary: '#ffb457', secondary: '#ff6f91' },
  { name: '玫瑰粉', primary: '#ff7ac6', secondary: '#a56bff' },
  { name: '石墨灰', primary: '#c9d1e6', secondary: '#8e9ac4' },
];

const changeTheme = (theme: { primary: string; secondary: string }) => {
  tempTheme.value = { primary: theme.primary, secondary: theme.secondary };
};

const changeCustomTheme = (color: string) => {
  if (color) {
    const secondaryColor = getAdjacentColor(color);
    tempTheme.value = { primary: color, secondary: secondaryColor };
  }
};

const confirmTheme = () => {
  updateTheme(tempTheme.value.primary, tempTheme.value.secondary);
  saveTheme(tempTheme.value.primary, tempTheme.value.secondary);
};

const resetTheme = () => {
  tempTheme.value = { primary: currentTheme.value, secondary: secondaryTheme.value };
  customColor.value = currentTheme.value;
};

const syncTempTheme = () => {
  tempTheme.value = { primary: currentTheme.value, secondary: secondaryTheme.value };
  customColor.value = currentTheme.value;
};

const updateTheme = (primary: string, secondary: string) => {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--secondary-color', secondary);
  root.style.setProperty('--accent', primary);
  root.style.setProperty('--accent-2', secondary);

  const darkColors = getDarkAdjacentColors(primary);
  darkColors.forEach((color, index) => {
    root.style.setProperty(`--dark-color-${index + 1}`, color);
  });

  currentTheme.value = primary;
  secondaryTheme.value = secondary;
  customColor.value = primary;

  document.body.classList.add('fade-in');
  setTimeout(() => {
    document.body.classList.remove('fade-in');
  }, 500);
};

const saveTheme = (primary: string, secondary: string) => {
  localStorage.setItem('themePrimary', primary);
  localStorage.setItem('themeSecondary', secondary);
};

const loadTheme = () => {
  try {
    const primary = localStorage.getItem('themePrimary') || '#6e8bff';
    const secondary = localStorage.getItem('themeSecondary') || '#a56bff';
    currentTheme.value = primary;
    secondaryTheme.value = secondary;
    customColor.value = primary;
    updateTheme(primary, secondary);
  } catch (error) {
    currentTheme.value = '#6e8bff';
    secondaryTheme.value = '#a56bff';
    customColor.value = '#6e8bff';
    updateTheme('#6e8bff', '#a56bff');
  }
};

const getAdjacentColor = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const newR = Math.min(255, r + 30);
  const newG = Math.min(255, g - 10);
  const newB = Math.min(255, b + 20);
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

const getDarkAdjacentColors = (hex: string): string[] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [
    `#${Math.max(0, r - 50).toString(16).padStart(2, '0')}${Math.max(0, g - 40).toString(16).padStart(2, '0')}${Math.max(0, b - 30).toString(16).padStart(2, '0')}`,
    `#${Math.max(0, r - 30).toString(16).padStart(2, '0')}${Math.max(0, g - 60).toString(16).padStart(2, '0')}${Math.max(0, b - 50).toString(16).padStart(2, '0')}`,
    `#${Math.max(0, r - 70).toString(16).padStart(2, '0')}${Math.max(0, g - 30).toString(16).padStart(2, '0')}${Math.max(0, b - 60).toString(16).padStart(2, '0')}`,
    `#${Math.max(0, r - 40).toString(16).padStart(2, '0')}${Math.max(0, g - 70).toString(16).padStart(2, '0')}${Math.max(0, b - 40).toString(16).padStart(2, '0')}`,
    `#${Math.max(0, r - 60).toString(16).padStart(2, '0')}${Math.max(0, g - 50).toString(16).padStart(2, '0')}${Math.max(0, b - 70).toString(16).padStart(2, '0')}`,
    `#${Math.max(0, r - 50).toString(16).padStart(2, '0')}${Math.max(0, g - 60).toString(16).padStart(2, '0')}${Math.max(0, b - 50).toString(16).padStart(2, '0')}`,
  ];
};

onMounted(() => {
  loadTheme();
});
</script>

<style>
/* ============================================================
   应用骨架
   ============================================================ */
html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.main-content {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

/* ============================================================
   悬浮玻璃侧栏
   ============================================================ */
.glass-sidebar {
  flex: 0 0 auto;
  margin: 16px 0 16px 16px;
  height: calc(100vh - 32px);
  box-sizing: border-box;
  border-radius: 26px;
  border: 1px solid var(--stroke-soft);
  /* 背景是静态渐变，用纯半透明底色即可，去掉 backdrop-filter 以免子菜单
     高度动画时逐帧重算毛玻璃（会与 3D 渲染争抢合成时间） */
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.042) 100%
  );
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  z-index: 10;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: width 0.32s var(--ease), padding 0.32s var(--ease);
}

/* 收起态：只留图标（没有图标用首字），宽度大幅收窄 */
.glass-sidebar.is-collapsed {
  padding: 20px 6px;
}

.glass-sidebar.is-collapsed .sidebar-header {
  padding: 4px 0 16px;
}

.glass-sidebar.is-collapsed .logo-row {
  justify-content: center;
}

.glass-sidebar.is-collapsed .brand {
  display: none;
}

.glass-sidebar.is-collapsed .nav-micro,
.glass-sidebar.is-collapsed .theme-label {
  display: none;
}

/* 折叠态：内联子菜单（不再使用 Element Plus 的 popover 折叠） */
.glass-sidebar.is-collapsed .nav-text,
.glass-sidebar.is-collapsed .el-sub-menu__icon-arrow {
  display: none;
}

.glass-sidebar.is-collapsed .el-menu-item,
.glass-sidebar.is-collapsed .el-sub-menu__title {
  padding: 0 !important;
  justify-content: center;
}

/* 当前场景属于该分组时，折叠态分组图标保持高光 */
.glass-sidebar.is-collapsed .el-sub-menu.is-active > .el-sub-menu__title {
  position: relative;
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: var(--stroke) !important;
  color: var(--text-1) !important;
}

.glass-sidebar.is-collapsed .el-sub-menu.is-active > .el-sub-menu__title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 11px;
  bottom: 11px;
  width: 3px;
  border-radius: 3px;
  background: var(--accent);
}

/* 折叠态子项列表：贴图标下方展开，去掉浮层式面板 */
.glass-sidebar.is-collapsed .el-sub-menu .el-menu {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  margin: 2px 0 6px !important;
  padding: 0 !important;
}

.glass-sidebar.is-collapsed .el-sub-menu .el-menu-item {
  height: 34px;
  line-height: 34px;
  margin: 2px 0 !important;
  padding: 0 !important;
  justify-content: center;
}

.glass-sidebar.is-collapsed .el-sub-menu .el-menu-item:hover {
  padding: 0 !important;
}

.glass-sidebar.is-collapsed .nav-badge {
  width: 26px;
  height: 26px;
  min-width: 0;
  margin-right: 0;
  border-radius: 8px;
  border: 1px solid var(--stroke-soft);
  background: rgba(255, 255, 255, 0.06);
  font-size: 13px;
  color: var(--text-2);
}

.glass-sidebar.is-collapsed .el-menu-item.is-active .nav-badge {
  border-color: var(--stroke);
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-1);
}

.glass-sidebar.is-collapsed .theme-button {
  padding: 0;
  gap: 0;
}

.glass-sidebar::-webkit-scrollbar {
  width: 4px;
}

/* Logo */
.sidebar-header {
  margin-bottom: 18px;
  padding: 4px 6px 18px;
  border-bottom: 1px solid var(--stroke-soft);
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-tile {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 13px;
  border: 1px solid var(--stroke);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.16),
    rgba(255, 255, 255, 0.05)
  );
  color: var(--text-1);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 8px 24px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s var(--ease), border-color 0.3s var(--ease);
}

.logo-tile:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.3);
}

.logo-tile:active {
  transform: translateY(0) scale(0.96);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  text-decoration: none;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-1);
  line-height: 1.1;
}

.brand-micro {
  font-size: 10px;
  letter-spacing: 0.2em;
  line-height: 1;
}

/* ============================================================
   导航（去渐变，玻璃态）
   ============================================================ */
.glass-sidebar .el-menu {
  background: transparent !important;
  border: none !important;
  flex: 1;
}

.glass-sidebar .el-menu-item,
.glass-sidebar .el-sub-menu__title {
  height: 42px;
  line-height: 42px;
  border-radius: 12px !important;
  margin: 3px 2px !important;
  padding: 0 12px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--text-2) !important;
  transition: background 0.25s var(--ease), color 0.25s var(--ease),
    border-color 0.25s var(--ease), transform 0.25s var(--ease) !important;
}

.glass-sidebar .el-menu-item:hover,
.glass-sidebar .el-sub-menu__title:hover {
  background: var(--glass-hover) !important;
  border-color: var(--stroke-soft) !important;
  color: var(--text-1) !important;
  transform: none !important;
}

.glass-sidebar .el-menu-item.is-active {
  position: relative;
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: var(--stroke) !important;
  color: var(--text-1) !important;
  font-weight: 600;
}

.glass-sidebar .el-menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 11px;
  bottom: 11px;
  width: 3px;
  border-radius: 3px;
  background: var(--accent);
}

.glass-sidebar .el-sub-menu.is-opened > .el-sub-menu__title {
  background: var(--glass-hover) !important;
  border-color: var(--stroke-soft) !important;
  color: var(--text-1) !important;
  transform: none !important;
}

.glass-sidebar .el-sub-menu__title span,
.glass-sidebar .el-menu-item span {
  font-size: 13.5px;
}

/* 子菜单内的次级菜单 */
.glass-sidebar .el-sub-menu .el-menu {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid var(--stroke-soft) !important;
  border-radius: 14px !important;
  margin: 4px 2px 8px !important;
  padding: 4px !important;
  box-shadow: none !important;
  /* 不使用 backdrop-filter：它嵌在已带层级的侧栏内，
     高度动画期间每帧都要重新采样背景，是卡顿主因 */
  contain: paint;
}

.glass-sidebar .el-sub-menu .el-menu-item {
  height: 36px;
  line-height: 36px;
  padding-left: 22px !important;
  border-radius: 10px !important;
  margin: 2px 2px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
}

.glass-sidebar .el-sub-menu .el-menu-item:hover {
  background: var(--glass-hover) !important;
  border-color: transparent !important;
  padding-left: 24px !important;
  transform: none !important;
  box-shadow: none !important;
}

.glass-sidebar .el-sub-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.1) !important;
  color: var(--text-1) !important;
  border-left: none !important;
}

.glass-sidebar .el-icon {
  color: currentColor;
  font-size: 15px;
}

.nav-text {
  color: inherit;
}

.nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 20px;
  margin-right: 8px;
  font-size: 14px;
  line-height: 1;
}

.nav-micro {
  margin-left: auto;
  margin-right: 22px;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--text-3);
  font-weight: 600;
}

/* ============================================================
   主题设置
   ============================================================ */
.theme-section {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--stroke-soft);
}

.theme-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--stroke-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.25s var(--ease), border-color 0.25s var(--ease),
    color 0.25s var(--ease);
}

.theme-button:hover {
  background: var(--glass-hover);
  border-color: var(--stroke);
  color: var(--text-1);
}

.theme-picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 2px;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-hint {
  font-size: 12px;
  color: var(--text-2);
}

.theme-colors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 8px;
}

.theme-color-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.theme-color {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
}

.theme-color-wrapper:hover .theme-color {
  transform: scale(1.08);
}

.theme-color.active {
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.85),
    0 0 16px rgba(255, 255, 255, 0.3);
}

.theme-color-name {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--stroke-soft);
  background: rgba(255, 255, 255, 0.04);
}

.picker-actions {
  display: flex;
  gap: 10px;
}

.picker-btn {
  flex: 1;
  justify-content: center;
  padding: 9px 16px;
  font-size: 13px;
}

.picker-btn.ghost {
  background: transparent;
  color: var(--text-2);
}

.picker-btn.ghost:hover {
  color: var(--text-1);
}

/* Element 弹层内的色板（深色） */
.theme-picker .el-color-picker__trigger {
  border-color: var(--stroke) !important;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
}
</style>
