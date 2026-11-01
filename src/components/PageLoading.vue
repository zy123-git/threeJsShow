<template>
  <transition name="page-loading">
    <div
      v-if="pageLoading.visible"
      class="page-loading"
      role="status"
      aria-live="polite"
    >
      <div class="loading-card">
        <div class="loading-emblem" aria-hidden="true">
          <span class="emblem-ring ring-outer"></span>
          <span class="emblem-ring ring-inner"></span>
          <span class="emblem-core"></span>
        </div>

        <div class="loading-head">
          <span class="micro">LOADING SCENE</span>
          <span class="loading-title">{{ pageLoading.label }}</span>
        </div>

        <div class="loading-track">
          <div class="loading-fill" :style="{ width: `${percent}%` }"></div>
        </div>

        <div class="loading-foot">
          <span class="loading-percent">{{ percent }}<i>%</i></span>
          <span class="loading-hint">正在构建 3D 场景</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pageLoading } from '../utils/pageLoading';

const percent = computed(() => Math.round(pageLoading.percent));
</script>

<style scoped>
.page-loading {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at 50% 44%,
    rgba(24, 33, 66, 0.72) 0%,
    rgba(7, 10, 22, 0.9) 62%,
    rgba(5, 7, 16, 0.94) 100%
  );
  backdrop-filter: blur(14px);
}

.loading-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(360px, 74vw);
  padding: 28px 28px 22px;
  border-radius: 22px;
  border: 1px solid var(--stroke);
  background: linear-gradient(
    165deg,
    rgba(255, 255, 255, 0.11) 0%,
    rgba(255, 255, 255, 0.035) 100%
  );
  box-shadow:
    0 28px 70px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.loading-emblem {
  position: relative;
  width: 54px;
  height: 54px;
  margin: 0 auto 2px;
}

.emblem-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.ring-outer {
  inset: 0;
  border-top-color: var(--accent);
  border-right-color: var(--accent);
  animation: loading-spin 1.1s linear infinite;
}

.ring-inner {
  inset: 9px;
  border-bottom-color: var(--accent-2);
  animation: loading-spin 1.6s linear infinite reverse;
}

.emblem-core {
  position: absolute;
  inset: 22px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 16px var(--accent);
  animation: loading-pulse 1.4s ease-in-out infinite;
}

.loading-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.loading-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-1);
}

.loading-track {
  position: relative;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
}

.loading-fill {
  position: relative;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 14px var(--accent);
  transition: width 0.28s var(--ease);
}

.loading-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.5),
    transparent
  );
  transform: translateX(-100%);
  animation: loading-shimmer 1.4s ease-in-out infinite;
}

.loading-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.loading-percent {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.loading-percent i {
  margin-left: 1px;
  font-style: normal;
  font-size: 10px;
  color: var(--text-3);
}

.loading-hint {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--text-3);
}

.page-loading-enter-active,
.page-loading-leave-active {
  transition: opacity 0.32s var(--ease);
}

.page-loading-enter-from,
.page-loading-leave-to {
  opacity: 0;
}

.page-loading-enter-active .loading-card {
  animation: loading-card-in 0.45s var(--ease);
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes loading-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.86);
  }
}

@keyframes loading-shimmer {
  0% {
    transform: translateX(-100%);
  }
  60%,
  100% {
    transform: translateX(100%);
  }
}

@keyframes loading-card-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
