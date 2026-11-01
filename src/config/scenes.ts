import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import { Box, MagicStick, Star, Sunrise } from '@element-plus/icons-vue';

export interface SceneGroup {
  key: string;
  title: string;
  micro: string;
  icon: Component;
}

export interface SceneEntry {
  path: string;
  name: string;
  /** 侧栏、首页卡片、页面壳统一使用的名称 */
  title: string;
  group: string;
  /** 首页卡片图标（emoji） */
  icon: string;
  description: string;
  tags: string[];
  component: RouteRecordRaw['component'];
  /** 是否出现在首页，默认 true */
  card?: boolean;
  /** 侧栏同组内排序，省略时排在同组末尾 */
  navOrder?: number;
}

// 侧栏分组（顺序即侧栏分组顺序）
export const SCENE_GROUPS: SceneGroup[] = [
  { key: 'nature', title: '自然场景', micro: 'NATURE', icon: Sunrise },
  { key: 'particles', title: '粒子效果', micro: 'PARTICLES', icon: Star },
  { key: 'models', title: '3D 模型', micro: 'MODELS', icon: Box },
  { key: 'effects', title: '特效动画', micro: 'EFFECTS', icon: MagicStick },
];

// 场景总表：新增页面只需在这里加一条，路由 / 侧栏 / 首页卡片会自动同步。
// 数组顺序即首页卡片顺序，新场景默认追加在末尾。
export const SCENES: SceneEntry[] = [
  {
    path: '/html-galaxy',
    name: 'HTMLGalaxy',
    title: '星系',
    group: 'effects',
    icon: '🌠',
    description: '星系效果，轻量级动画展示',
    tags: ['粒子', '动画'],
    component: () => import('../views/HTMLGalaxy.vue'),
  },
  {
    path: '/html-scroll',
    name: 'HTMLScroll',
    title: '滚动特效',
    group: 'effects',
    icon: '📜',
    description: '文字滚动动画效果，渐变色彩与流畅过渡',
    tags: ['文字', '滚动'],
    component: () => import('../views/HTMLScroll.vue'),
  },
  {
    path: '/html-model',
    name: 'HTMLModel',
    title: '3D 模型',
    group: 'models',
    icon: '🖼️',
    description: 'Three.js 实现的3D模型展示',
    tags: ['3D', '模型'],
    component: () => import('../views/HTMLModel.vue'),
    navOrder: 0,
  },
  {
    path: '/html-wobbly-sphere',
    name: 'HTMLWobblySphere',
    title: '可变形球体',
    group: 'effects',
    icon: '🌍',
    description: '可变形球体效果，自定义着色器实现',
    tags: ['着色器', '变形'],
    component: () => import('../views/HTMLWobblySphere.vue'),
  },
  {
    path: '/html-sea',
    name: 'HTMLSea',
    title: '海洋',
    group: 'nature',
    icon: '🌊',
    description: '海浪模拟，动态水面效果',
    tags: ['水面', '物理'],
    component: () => import('../views/HTMLSea.vue'),
    navOrder: 1,
  },
  {
    path: '/html-forest',
    name: 'HTMLForest',
    title: '森林',
    group: 'nature',
    icon: '🌲',
    description: '森林效果，动态环境模拟',
    tags: ['自然', '环境'],
    component: () => import('../views/HTMLForest.vue'),
    navOrder: 0,
  },
  {
    path: '/html-fireworks',
    name: 'HTMLFireworks',
    title: '烟花',
    group: 'nature',
    icon: '🎆',
    description: '烟花效果，动态环境模拟',
    tags: ['粒子', '特效'],
    component: () => import('../views/HTMLFireworks.vue'),
  },
  {
    path: '/html-basic',
    name: 'HTMLBasic',
    title: '基础场景',
    group: 'models',
    icon: '🧊',
    description: '基础3D场景，包含立方体、灯光与轨道控制',
    tags: ['3D', '基础'],
    component: () => import('../views/HTMLBasic.vue'),
    navOrder: 4,
  },
  {
    path: '/html-classroom',
    name: 'HTMLClassroom',
    title: '教室',
    group: 'models',
    icon: '🏫',
    description: '3D教室模型展示，可交互查看',
    tags: ['室内', '交互'],
    component: () => import('../views/HTMLClassroom.vue'),
    navOrder: 1,
  },
  {
    path: '/html-particles',
    name: 'HTMLParticles',
    title: '粒子特效',
    group: 'particles',
    icon: '✨',
    description: '粒子特效展示，动态环境模拟',
    tags: ['粒子', '特效'],
    component: () => import('../views/HTMLParticles.vue'),
  },
  {
    path: '/html-flow-particles',
    name: 'HTMLFlowParticles',
    title: '流动粒子',
    group: 'particles',
    icon: '💫',
    description: '流动粒子特效展示，动态环境模拟',
    tags: ['流动', '粒子'],
    component: () => import('../views/HTMLFlowParticles.vue'),
  },
  {
    path: '/html-morph-particles',
    name: 'HTMLMorphParticles',
    title: '变形粒子',
    group: 'particles',
    icon: '🔄',
    description: '变形粒子特效展示，动态环境模拟',
    tags: ['变形', '粒子'],
    component: () => import('../views/HTMLMorphParticles.vue'),
  },
  {
    path: '/html-cassette',
    name: 'HTMLCassette',
    title: '柔光变电柜',
    group: 'models',
    icon: '🎞️',
    description: '柔光棚与科技蓝双外观的变电柜场景，含 SSAO、Bloom 与体积雾',
    tags: ['程序化', 'PBR材质'],
    component: () => import('../views/HTMLCassette.vue'),
    navOrder: 2,
  },
  {
    path: '/html-rigging',
    name: 'HTMLRigging',
    title: '骨骼动画',
    group: 'models',
    icon: '🦴',
    description: '带骨骼绑定的蒙皮模型，可切换内置动作的播放与暂停',
    tags: ['骨骼', '动画'],
    component: () => import('../views/HTMLRigging.vue'),
    navOrder: 3,
  },
];

// 由总表派生路由
export const sceneRoutes: RouteRecordRaw[] = SCENES.map((scene) => ({
  path: scene.path,
  name: scene.name,
  meta: { scene: true, title: scene.title, group: scene.group },
  component: scene.component,
}));
