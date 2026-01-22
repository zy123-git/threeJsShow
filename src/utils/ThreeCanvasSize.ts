import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useThreeStore } from '@/store/modules/three';

// 定义尺寸接口
export interface CanvasSize {
  width: number;
  height: number;
  navbarHeight: number;
}

/**
 * 计算减去导航栏后的可用尺寸
 * @returns 包含宽度、高度和导航栏高度的对象
 */
export const calculateAvailableSize = (): CanvasSize => {
  // 获取窗口视口尺寸
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  // 从Pinia store获取导航栏高度
  const threeStore = useThreeStore();
  const navbarHeight = threeStore.navbarHeight;
  
  // 计算可用高度（视口高度减去导航栏高度）
  const availableHeight = viewportHeight - navbarHeight;
  
  return {
    width: viewportWidth,
    height: availableHeight,
    navbarHeight: navbarHeight
  };
};

/**
 * 设置容器位置，确保从导航栏下方开始
 * @param containerSelector 容器的CSS选择器
 * @param navbarHeight 导航栏高度
 */
export const setContainerPosition = (containerSelector: string, navbarHeight: number): void => {
  const container = document.querySelector(containerSelector);
  if (container) {
    // (container as HTMLElement).style.top = `${navbarHeight}px`;
    (container as HTMLElement).style.top = '100px';
    (container as HTMLElement).style.height = `${window.innerHeight - navbarHeight}px`;
  }
};

/**
 * 响应式画布尺寸组合函数
 * @param containerSelector 容器的CSS选择器，默认为'.three-container'
 * @returns 包含尺寸信息和更新方法的对象
 */
export const useCanvasSize = (containerSelector: string = '.three-container') => {
  // 响应式尺寸状态
  const sizes = ref<CanvasSize>(calculateAvailableSize());
  
  // 更新尺寸的方法
  const updateSize = () => {
    sizes.value = calculateAvailableSize();
    // 更新容器位置
    // setContainerPosition(containerSelector, size.value.navbarHeight);
  };
  
  // 监听窗口大小变化
  onMounted(() => {
    window.addEventListener('resize', updateSize);
    // 初始化时更新一次
    updateSize();
  });
  
  onUnmounted(() => {
    window.removeEventListener('resize', updateSize);
  });
  
  return {
    sizes,
    updateSize,
    calculateAvailableSize,
    setContainerPosition
  };
};