<template>
  <div class="scroll-content">
    <div class="text-section-left">
      <h1 class="gradient-text">我们在田野上面找猪</h1>
      <h1 class="gradient-text">想象中已找到了三只</h1>
    </div>
    <div class="text-section-right">
      <h1 class="gradient-text">小鸟在白云上面追逐</h1>
      <h1 class="gradient-text">它们在树底下跳舞</h1>
    </div>
    <div class="text-section-left">
      <h1 class="gradient-text">啦啦啦啦啦啦啦啦咧</h1>
      <h1 class="gradient-text">啦啦啦啦咧</h1>
    </div>
  </div>

  <ThreeScroll></ThreeScroll>
</template>

<script setup>
import ThreeScroll from '../three/ThreeScroll.vue';
import { ref, onMounted, onUnmounted } from 'vue';

const scrollY = ref(0);

const handleScroll = () => {
  scrollY.value = window.scrollY;
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style>
.scrollbar {
  width: 100vw;
  height: 100vh;
}

.scroll-content {
  min-height: 300vh;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  background-color: rgb(1, 2, 4);
}

.text-section-left {
  margin: 10rem 0;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin-left: 10vw;
  margin-right: auto;
  text-align: left;
}

.text-section-right {
  margin: 10rem 0;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin-left: auto;
  margin-right: 10vw;
  text-align: right;
}

.gradient-text {
  font-size: 3rem;
  font-weight: bold;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-animation 3s ease infinite;
  margin: 1rem 0;
  line-height: 1.4;
}

@keyframes gradient-animation {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
