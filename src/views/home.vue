<template>
  <div class="home-container">
    <!-- 英雄区域 - 使用玻璃拟态卡片 -->
    <el-card class="hero-card" shadow="never">
      <div class="hero-content">
        <el-avatar 
          :size="80" 
          class="hero-icon"
          :style="{ background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))' }"
        >
          <el-icon :size="40"><View /></el-icon>
        </el-avatar>
        <h1 class="home-title gradient-text-bold">欢迎来到3D可视化世界</h1>
        <p class="home-subtitle gradient-text">选择您想要探索的场景，开启沉浸式视觉之旅</p>
        <el-button 
          type="primary" 
          size="large" 
          round 
          class="cta-button"
          @click="scrollToGrid"
        >
          <el-icon><ArrowDown /></el-icon>
          开始探索
        </el-button>
      </div>
    </el-card>

    <!-- 场景网格 - 使用Element Plus的el-row和el-col -->
    <div ref="gridRef" class="scenes-section">
      <el-divider content-position="center">
        <span class="section-title gradient-text-medium">✨ 探索场景</span>
      </el-divider>

      <el-row :gutter="24" class="scenes-grid">
        <el-col 
          v-for="(scene, index) in scenes" 
          :key="index"
          :xs="24" 
          :sm="12" 
          :md="8" 
          :lg="6"
          class="scene-col"
        >
          <el-card 
            class="scene-card glass-card" 
            shadow="hover"
            :body-style="{ padding: '0' }"
          >
            <div class="scene-image-wrapper">
              <div class="scene-icon">{{ scene.icon }}</div>
              <div class="scene-overlay">
                <el-button 
                  type="primary" 
                  round
                  class="enter-button"
                  @click="$router.push(scene.path)"
                >
                  <el-icon><ArrowRight /></el-icon>
                  进入场景
                </el-button>
              </div>
            </div>
            <div class="scene-content">
              <h3 class="scene-title gradient-text-medium">{{ scene.title }}</h3>
              <p class="scene-desc gradient-text">{{ scene.description }}</p>
              <div class="scene-tags">
                <el-tag 
                  v-for="(tag, tagIndex) in scene.tags" 
                  :key="tagIndex"
                  size="small"
                  effect="light"
                  class="scene-tag"
                >
                  {{ tag }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 页脚 - 使用玻璃拟态风格 -->
    <el-card class="footer-card" shadow="never">
      <div class="footer-content">
        <el-icon :size="20"><InfoFilled /></el-icon>
        <span class="gradient-text">点击任意卡片开始探索 →</span>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { View, ArrowDown, ArrowRight, InfoFilled } from '@element-plus/icons-vue';

const router = useRouter();
const gridRef = ref(null);

const scrollToGrid = () => {
  gridRef.value?.scrollIntoView({ behavior: 'smooth' });
};

// 场景数据
const scenes = [
  {
    icon: '🌠',
    title: '星系',
    description: '星系效果，轻量级动画展示',
    path: '/html-galaxy',
    tags: ['粒子', '动画']
  },
  {
    icon: '📜',
    title: '滚动特效',
    description: '文字滚动动画效果，渐变色彩与流畅过渡',
    path: '/html-scroll',
    tags: ['文字', '滚动']
  },
  {
    icon: '🖼️',
    title: '3D模型',
    description: 'Three.js 实现的3D模型展示',
    path: '/html-model',
    tags: ['3D', '模型']
  },
  {
    icon: '🌍',
    title: '可变形球体',
    description: '可变形球体效果，自定义着色器实现',
    path: '/html-wobbly-sphere',
    tags: ['着色器', '变形']
  },
  {
    icon: '🌊',
    title: '海洋',
    description: '海浪模拟，动态水面效果',
    path: '/html-sea',
    tags: ['水面', '物理']
  },
  {
    icon: '🌲',
    title: '森林',
    description: '森林效果，动态环境模拟',
    path: '/html-forest',
    tags: ['自然', '环境']
  },
  {
    icon: '🎆',
    title: '烟花',
    description: '烟花效果，动态环境模拟',
    path: '/html-fireworks',
    tags: ['粒子', '特效']
  },
  {
    icon: '🏫',
    title: '教室',
    description: '3D教室模型展示，可交互查看',
    path: '/html-classroom',
    tags: ['室内', '交互']
  },
  {
    icon: '✨',
    title: '粒子特效',
    description: '粒子特效展示，动态环境模拟',
    path: '/html-particles',
    tags: ['粒子', '特效']
  },
  {
    icon: '💫',
    title: '流动粒子',
    description: '流动粒子特效展示，动态环境模拟',
    path: '/html-flow-particles',
    tags: ['流动', '粒子']
  },
  {
    icon: '🔄',
    title: '变形粒子',
    description: '变形粒子特效展示，动态环境模拟',
    path: '/html-morph-particles',
    tags: ['变形', '粒子']
  }
];
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  padding: 2rem;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}

/* 英雄区域 */
.hero-card {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  border-radius: 24px !important;
  margin-bottom: 3rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 2rem;
}

.hero-icon {
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.home-title {
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.home-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  max-width: 600px;
}

.cta-button {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7)) !important;
  border: none !important;
  color: var(--primary-color) !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.cta-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

/* 场景区域 */
.scenes-section {
  margin-bottom: 3rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.scenes-grid {
  margin-top: 2rem;
}

.scene-col {
  margin-bottom: 1.5rem;
}

/* 玻璃拟态卡片 */
.glass-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  border-radius: 20px !important;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
}

.glass-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
}

.scene-image-wrapper {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, rgba(var(--primary-color), 0.1), rgba(var(--secondary-color), 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.scene-icon {
  font-size: 4rem;
  transition: transform 0.4s ease;
}

.glass-card:hover .scene-icon {
  transform: scale(1.1) rotate(5deg);
}

.scene-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease;
}

.glass-card:hover .scene-overlay {
  opacity: 0.95;
}

.enter-button {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.3s ease 0.1s;
  background: white !important;
  color: var(--primary-color) !important;
  border: none !important;
}

.glass-card:hover .enter-button {
  transform: translateY(0);
  opacity: 1;
}

.scene-content {
  padding: 1.5rem;
}

.scene-title {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.scene-desc {
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.scene-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.scene-tag {
  background: linear-gradient(135deg, rgba(var(--primary-color), 0.1), rgba(var(--secondary-color), 0.1)) !important;
  border: none !important;
  color: var(--primary-color) !important;
}

/* 页脚 */
.footer-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 16px !important;
  text-align: center;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: white;
}

/* 响应式 */
@media (max-width: 768px) {
  .home-container {
    padding: 1rem;
  }

  .home-title {
    font-size: 2rem;
  }

  .home-subtitle {
    font-size: 1rem;
  }

  .hero-content {
    padding: 2rem 1rem;
  }

  .scene-col {
    margin-bottom: 1rem;
  }
}
</style>
