import { defineStore } from 'pinia';
import { ref, onMounted, watch } from 'vue';

export const useThreeStore = defineStore('three', () => {
  const scrollY = ref(0);
  const navbarHeight = ref(0);

  // 更新导航栏高度的方法
  const updateNavbarHeight = () => {
    const navbarElements = document.querySelectorAll('nav');
    if (navbarElements.length > 0) {
      navbarHeight.value = navbarElements[0].getBoundingClientRect().height;
    }
  };

  // 监听窗口大小变化，重新计算导航栏高度
  onMounted(() => {
    // 初始化导航栏高度
    updateNavbarHeight();
    // 监听窗口大小变化
    window.addEventListener('resize', updateNavbarHeight);
  });

  // 清理事件监听器
  const cleanup = () => {
    window.removeEventListener('resize', updateNavbarHeight);
  };

  return { scrollY, navbarHeight, updateNavbarHeight, cleanup };
});
