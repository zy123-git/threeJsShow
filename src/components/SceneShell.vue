<template>
  <section class="scene-shell">
    <header class="scene-bar">
      <button class="back-btn" type="button" aria-label="返回首页" @click="goHome">
        <el-icon :size="15"><ArrowLeft /></el-icon>
      </button>

      <div class="bar-text">
        <span class="micro">{{ micro }}</span>
        <h1 class="bar-title">{{ title }}</h1>
      </div>

      <div class="bar-slot">
        <slot name="actions" />
      </div>
    </header>

    <div class="scene-stage">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';

withDefaults(
  defineProps<{
    title?: string;
    micro?: string;
  }>(),
  {
    title: '场景',
    micro: 'SCENE / THREE.JS',
  }
);

const router = useRouter();

const goHome = () => {
  if (window.history.length > 1) router.back();
  else router.push('/');
};
</script>

<style scoped>
.scene-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

.scene-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 6px;
  height: 44px;
  flex: 0 0 auto;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--stroke);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-1);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: background 0.25s var(--ease), border-color 0.25s var(--ease),
    transform 0.25s var(--ease);
}
.back-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.28);
  transform: translateX(-2px);
}

.bar-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.bar-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-slot {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 画布舞台：圆角 + 内描边，作为"嵌入式玻璃窗口" */
.scene-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 20px;
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--stroke-soft);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.scene-stage :deep(.three-container) {
  width: 100%;
  height: 100%;
}
</style>
