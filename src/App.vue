<template>
  <div class="app-container">
    <!-- 玻璃拟态侧边栏 -->
    <el-aside class="glass-sidebar" width="260px">
      <!-- Logo区域 -->
      <div class="sidebar-header">
        <router-link to="/" class="logo-link">
          <el-avatar
            :size="48"
            class="logo-avatar"
            :style="{ background: `linear-gradient(135deg, ${currentTheme}, ${secondaryTheme})` }"
          >
            <el-icon><View /></el-icon>
          </el-avatar>
          <span class="logo-text gradient-text-bold">3D视界</span>
        </router-link>
      </div>

      <!-- 导航菜单 -->
      <el-menu
        :default-active="activeRoute"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <template #title>
            <span class="gradient-text-medium">🏠 首页</span>
          </template>
        </el-menu-item>

        <el-sub-menu index="nature">
          <template #title>
            <el-icon><Sunrise /></el-icon>
            <span class="gradient-text-medium">🌿 自然场景</span>
          </template>
          <el-menu-item index="/html-forest">
            <span class="gradient-text">🌲 森林</span>
          </el-menu-item>
          <el-menu-item index="/html-sea">
            <span class="gradient-text">🌊 海洋</span>
          </el-menu-item>
          <el-menu-item index="/html-fireworks">
            <span class="gradient-text">🎆 烟花</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="particles">
          <template #title>
            <el-icon><Star /></el-icon>
            <span class="gradient-text-medium">✨ 粒子效果</span>
          </template>
          <el-menu-item index="/html-particles">
            <span class="gradient-text">粒子特效</span>
          </el-menu-item>
          <el-menu-item index="/html-flow-particles">
            <span class="gradient-text">流动粒子</span>
          </el-menu-item>
          <el-menu-item index="/html-morph-particles">
            <span class="gradient-text">变形粒子</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="models">
          <template #title>
            <el-icon><Box /></el-icon>
            <span class="gradient-text-medium">🎯 3D 模型</span>
          </template>
          <el-menu-item index="/html-model">
            <span class="gradient-text">🖼️ 3D 模型</span>
          </el-menu-item>
          <el-menu-item index="/html-classroom">
            <span class="gradient-text">🏫 教室</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="effects">
          <template #title>
            <el-icon><MagicStick /></el-icon>
            <span class="gradient-text-medium">⚡ 特效动画</span>
          </template>
          <el-menu-item index="/html-galaxy">
            <span class="gradient-text">🌠 星系</span>
          </el-menu-item>
          <el-menu-item index="/html-scroll">
            <span class="gradient-text">📜 滚动特效</span>
          </el-menu-item>
          <el-menu-item index="/html-wobbly-sphere">
            <span class="gradient-text">🌍 可变形球体</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>

      <!-- 主题色选择 -->
      <div class="theme-section">
        <el-popover
          placement="top-start"
          :width="400"
          trigger="click"
          @show="syncTempTheme"
        >
          <template #reference>
            <el-button
              type="primary"
              class="theme-button"
              round
            >
              <el-icon><ColorPickerPanel /></el-icon>
            </el-button>
          </template>

          <div class="theme-picker">
             <el-color-picker-panel
              v-model="customColor"
              @change="changeCustomTheme"
              :border="false"
              class="color-picker"
             />
            <div class="color-picker2">
              <div class="theme-colors">
                <div
                  v-for="(theme, index) in themes"
                  :key="index"
                  class="theme-color-wrapper"
                >
                  <div
                    class="theme-color"
                    :class="{ active: currentTheme === theme.primary }"
                    :style="{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }"
                    @click="changeTheme(theme)"
                  ></div>
                  <span class="theme-color-name gradient-text-small">{{ theme.name }}</span>
                </div>
              </div>
              <el-button-group class="theme-actions">
                <el-button
                  @click="confirmTheme"
                  class="color-preview-button"
                  :style="{ background: `linear-gradient(135deg, ${tempTheme.primary}, ${tempTheme.secondary})` }"
                  round
                >
                  确认
                </el-button>
                <el-button
                  @click="resetTheme"
                  class="color-preview-button"
                  :style="{ background: `linear-gradient(135deg, ${tempTheme.primary}, ${tempTheme.secondary})` }"
                  round
                >
                  重置
                </el-button>
              </el-button-group>
            </div>
          </div>
        </el-popover>
      </div>
    </el-aside>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  House,
  Sunrise,
  Star,
  Box,
  MagicStick,
  View,
} from '@element-plus/icons-vue';

const route = useRoute();
const isCollapse = ref(false);

const currentTheme = ref('#667eea');
const customColor = ref('#667eea');
const secondaryTheme = ref('#764ba2');

const activeRoute = computed(() => route.path);

const tempTheme = ref({ primary: currentTheme.value, secondary: secondaryTheme.value });

const themes = [
  { name: '梦幻紫', primary: '#667eea', secondary: '#764ba2' },
  { name: '清新蓝', primary: '#2acfb9', secondary: '#0fcfc9' },
  { name: '活力橙', primary: '#eab633', secondary: '#c44569' },
  { name: '优雅绿', primary: '#a8e6cf', secondary: '#0cb174' },
  { name: '浪漫粉', primary: '#f093fb', secondary: '#f5576c' },
  { name: '深海蓝', primary: '#4facfe', secondary: '#00f2fe' },
  { name: '日落橙', primary: '#fa709a', secondary: '#fee140' },
  { name: '森林绿', primary: '#38ef7d', secondary: '#11998e' },
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
    const primary = localStorage.getItem('themePrimary') || '#667eea';
    const secondary = localStorage.getItem('themeSecondary') || '#764ba2';
    currentTheme.value = primary;
    secondaryTheme.value = secondary;
    customColor.value = primary;
    updateTheme(primary, secondary);
  } catch (error) {
    currentTheme.value = '#667eea';
    secondaryTheme.value = '#764ba2';
    customColor.value = '#667eea';
    updateTheme('#667eea', '#764ba2');
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
body,
html {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

.main-content{
  height: 100vh;
  width: 100vw;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* ========== 玻璃拟态侧边栏 ========== */
.glass-sidebar {
  background: linear-gradient(180deg,
    rgba(255,255,255,0.12) 0%,
    rgba(255,255,255,0.03) 100%),
    linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  z-index: 10;
  overflow-y: auto;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
}

.sidebar-header {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
}

.logo-avatar {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
}

.logo-avatar:hover {
  transform: scale(1.05);
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
}

/* ========== Element Plus 菜单覆写 ========== */
.el-menu {
  background: transparent !important;
  border: none !important;
  flex: 1;
}

.el-menu-item {
  color: white !important;
  background: linear-gradient(135deg,
    rgba(255,255,255,0.12),
    rgba(255,255,255,0.05)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 12px !important;
  margin: 0.5rem 0.25rem !important;
  padding: 0.75rem 1rem !important;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12) !important;
  backdrop-filter: blur(8px) !important;
  transition: all 0.3s ease !important;
}

.el-menu-item:not(.is-active) {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.08),
    rgba(255,255,255,0.03)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
}

.el-menu-item:hover {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.20),
    rgba(255,255,255,0.10)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  transform: translateX(5px) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.el-menu-item.is-active {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.25),
    rgba(255,255,255,0.15)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border-left: 4px solid var(--primary-color) !important;
  transform: translateX(3px) !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15) !important;
}

.el-sub-menu__title {
  color: white !important;
  background: linear-gradient(135deg,
    rgba(255,255,255,0.10),
    rgba(255,255,255,0.04)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 12px !important;
  margin: 0.5rem 0.25rem !important;
  padding: 0.75rem 1rem !important;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12) !important;
  backdrop-filter: blur(8px) !important;
  transition: all 0.3s ease !important;
}

.el-sub-menu__title:hover {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.20),
    rgba(255,255,255,0.10)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  transform: translateX(5px) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.el-sub-menu.is-opened > .el-sub-menu__title {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.18),
    rgba(255,255,255,0.08)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border-left: 4px solid var(--primary-color) !important;
  transform: translateX(3px) !important;
}

.el-sub-menu .el-menu {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.12),
    rgba(255,255,255,0.04)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 10px !important;
  margin: 0.25rem !important;
  padding: 0.5rem !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15) !important;
  backdrop-filter: blur(12px) !important;
}

.el-sub-menu .el-menu-item {
  color: white !important;
  background: linear-gradient(135deg,
    rgba(255,255,255,0.06),
    rgba(255,255,255,0.02)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px !important;
  margin: 0.2rem 0.3rem !important;
  padding: 0.5rem 1rem 0.5rem 2.5rem !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08) !important;
  backdrop-filter: blur(5px) !important;
  transition: all 0.3s ease !important;
}

.el-sub-menu .el-menu-item:not(.is-active) {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.04),
    rgba(255,255,255,0.01)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
}

.el-sub-menu .el-menu-item:hover {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.16),
    rgba(255,255,255,0.06)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  transform: translateX(3px) !important;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12) !important;
  border-left: 3px solid white !important;
}

.el-sub-menu .el-menu-item.is-active {
  background: linear-gradient(135deg,
    rgba(255,255,255,0.20),
    rgba(255,255,255,0.10)),
    linear-gradient(145deg, var(--primary-color), var(--secondary-color)) !important;
  border-left: 3px solid white !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.el-icon {
  color: white;
  font-size: 1.2rem;
}

/* ========== 主题设置 ========== */
.theme-section {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.theme-button {
  width: 20px;
  margin-bottom: 0.5rem;
  border-radius: var(--border-radius);
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border: none;
  transition: all 0.3s ease;
}

.theme-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.theme-picker {
  display: grid;
  padding: 2px;
  background: rgba(255, 255, 255, 0.662);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  backdrop-filter: blur(10px);
  border: var(--border);
}

.color-picker {
  width: 100%;
}

.color-picker2 {
  display: flex;
}

.color-picker2 > .theme-colors {
  flex: 0 0 70%;
}

.color-picker2 > .theme-actions {
  flex: 0 0 30%;
}

.theme-colors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  min-width: 260px;
}

.theme-color-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.theme-color {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.theme-color-name {
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-color:hover {
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.theme-color.active {
  border-color: white;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
}

.theme-actions {
  display: grid !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  gap: 15px !important;
}

.theme-actions .el-button {
  margin: 0 !important;
  flex: 1;
  min-width: 80px;
}

.color-preview-button {
  transition: all 0.3s ease !important;
  border: 2px !important;
  border-radius: 20px !important;
  font-weight: 600 !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
  padding: 8px 16px !important;
  min-width: 80px !important;
  min-height: 40px !important;
  text-align: center !important;
}

.color-preview-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>
