<template>
  <el-scrollbar class="home-scrollbar">
    <div class="home-container">
      <!-- 顶部标题区 -->
      <section class="hero">
        <span class="micro">3D GALLERY · {{ scenes.length }} SCENES</span>
        <h1 class="hero-title">欢迎来到 3D 可视化世界</h1>
        <p class="hero-sub">选择您想要探索的场景，开启沉浸式视觉之旅</p>
        <button class="pill hero-cta" type="button" @click="scrollToGrid">
          开始探索
          <el-icon :size="14"><ArrowDown /></el-icon>
        </button>
      </section>

      <!-- 场景网格 -->
      <section ref="gridRef" class="scenes-section">
        <div class="section-head">
          <span class="micro">EXPLORE</span>
          <h2 class="section-title">探索场景</h2>
        </div>

        <div class="scenes-grid">
          <article
            v-for="(scene, index) in scenes"
            :key="index"
            class="scene-card"
            role="button"
            tabindex="0"
            :aria-label="scene.title"
            :style="{
              '--c1': CARD_TINTS[index % CARD_TINTS.length][0],
              '--c2': CARD_TINTS[index % CARD_TINTS.length][1],
              '--i': index,
            }"
            @click="openScene(scene.path)"
            @keydown.enter="openScene(scene.path)"
          >
            <div class="thumb">
              <span class="blob b1"></span>
              <span class="blob b2"></span>
              <span class="blob b3"></span>
              <span class="thumb-icon">{{ scene.icon }}</span>
            </div>

            <div class="scene-body">
              <h3 class="scene-title">{{ scene.title }}</h3>
              <p class="scene-desc">{{ scene.description }}</p>
              <div class="chips">
                <span v-for="(tag, tagIndex) in scene.tags" :key="tagIndex" class="chip">
                  {{ tag }}
                </span>
              </div>
            </div>

            <span class="card-arrow">
              <el-icon :size="13"><ArrowRight /></el-icon>
            </span>
          </article>
        </div>
      </section>

      <footer class="home-foot">
        <span class="micro">CLICK A CARD TO ENTER · THREE.JS STUDY</span>
      </footer>
    </div>

    <template #append>
      <el-backtop target=".home-scrollbar .el-scrollbar__wrap" :bottom="32" :right="24" />
    </template>
  </el-scrollbar>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue';
import { SCENES } from '@/config/scenes';

const router = useRouter();
const gridRef = ref(null);

const scrollToGrid = () => {
  gridRef.value?.scrollIntoView({ behavior: 'smooth' });
};

const openScene = (path) => {
  router.push(path);
};

// 卡片光斑配色（循环使用）
const CARD_TINTS = [
  ['#6e8bff', '#a56bff'],
  ['#37d2ff', '#5f8bff'],
  ['#ff7ac6', '#a56bff'],
  ['#38ef7d', '#12b8c9'],
  ['#ffb457', '#ff6f91'],
  ['#8e9ac4', '#c9d1e6'],
];

// 场景数据来自统一注册表，首页只展示 card !== false 的项
const scenes = SCENES.filter((scene) => scene.card !== false);
</script>

<style scoped>
.home-scrollbar {
  height: 100%;
}

.home-container {
  padding: 4px 8px 48px;
}

/* ---------- 标题区 ---------- */
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  max-width: 760px;
  padding: 40px 12px 44px;
}

.hero-title {
  margin: 6px 0 0;
  font-size: clamp(2rem, 3.2vw, 3rem);
  line-height: 1.12;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
}

.hero-sub {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-2);
  max-width: 520px;
}

.hero-cta {
  margin-top: 10px;
}

/* ---------- 区块标题 ---------- */
.scenes-section {
  padding: 0 4px;
}

.section-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.section-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.01em;
}

/* ---------- 卡片网格 ---------- */
.scenes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
  gap: 16px;
}

.scene-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid var(--stroke-soft);
  background: var(--glass);
  overflow: hidden;
  cursor: pointer;
  outline: none;
  animation: fadeIn 0.5s var(--ease) both;
  animation-delay: calc(var(--i) * 40ms);
  transition:
    transform 0.32s var(--ease),
    border-color 0.32s var(--ease),
    background 0.32s var(--ease),
    box-shadow 0.32s var(--ease);
}

.scene-card:hover,
.scene-card:focus-visible {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.085);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.36);
}

/* 缩略区：错位的彩色模糊块 */
.thumb {
  position: relative;
  height: 128px;
  overflow: hidden;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012));
  border-bottom: 1px solid var(--stroke-soft);
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(20px);
  opacity: 0.9;
  transition: transform 0.5s var(--ease);
}

.b1 {
  width: 118px;
  height: 118px;
  left: 16%;
  top: 12%;
  background: var(--c1);
}

.b2 {
  width: 96px;
  height: 96px;
  right: 14%;
  top: 30%;
  background: var(--c2);
  opacity: 0.75;
}

.b3 {
  width: 132px;
  height: 60px;
  left: 34%;
  bottom: -14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.32);
  filter: blur(16px);
  opacity: 0.5;
}

.scene-card:hover .b1 {
  transform: translate3d(6px, -6px, 0) scale(1.06);
}
.scene-card:hover .b2 {
  transform: translate3d(-8px, 8px, 0) scale(1.05);
}

.thumb-icon {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-size: 22px;
  line-height: 1;
  opacity: 0.7;
  filter: saturate(0.85);
}

/* 卡片内容 */
.scene-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px 18px;
}

.scene-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: 0;
}

.scene-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.chip {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke-soft);
  background: rgba(255, 255, 255, 0.04);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--text-3);
  line-height: 1.5;
}

.card-arrow {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 16, 34, 0.4);
  color: var(--text-1);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.3s var(--ease), transform 0.3s var(--ease);
  backdrop-filter: blur(10px);
}

.scene-card:hover .card-arrow,
.scene-card:focus-visible .card-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ---------- 页脚 ---------- */
.home-foot {
  margin-top: 40px;
  padding: 22px 12px 0;
  border-top: 1px solid var(--stroke-soft);
  display: flex;
  justify-content: center;
}

/* 回到顶部按钮（深色化） */
.home-scrollbar :deep(.el-backtop) {
  background: rgba(16, 20, 42, 0.9);
  border: 1px solid var(--stroke);
  color: var(--text-1);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .home-container {
    padding: 0 4px 40px;
  }

  .hero {
    padding: 24px 4px 32px;
  }

  .scenes-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .thumb {
    height: 104px;
  }
}
</style>
