import { ref, onUnmounted } from 'vue';
import * as THREE from 'three';

export interface ElementSize {
  width: number;
  height: number;
}

export const useElementSize = (containerSelector: string = '.three-container') => {
  const elementSize = ref<ElementSize>({ width: 0, height: 0 });
  let containerElement: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const updateElementSize = () => {
    // 每次都重新查询元素，确保能获取到最新的DOM元素
    containerElement = document.querySelector(containerSelector) as HTMLElement;
    if (containerElement) {
      elementSize.value = {
        width: containerElement.clientWidth,
        height: containerElement.clientHeight
      };
    }
    return containerElement;
  };

  // 防抖函数
  const debounce = (fn: Function, delay: number) => {
    let timer: number | null = null;
    return (...args: any[]) => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  };

  // 传入renderer，自动更新canvas尺寸
  const bindRenderer = (renderer: THREE.WebGLRenderer, camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera) => {
    // 确保元素已被查询
    if (!containerElement) {
      containerElement = updateElementSize();
    }
    
    if (!containerElement) {
      console.warn(`[useElementSize] 未找到容器元素: ${containerSelector}`);
      return;
    }

    const handleResize = debounce((width: number, height: number) => {
      elementSize.value = { width, height };
      
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      if (camera) {
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = width / height;
        }
        camera.updateProjectionMatrix();
      }
    }, 16); // ~1帧，减少抖动
    
    // 使用ResizeObserver监听容器尺寸变化
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        handleResize(entry.contentRect.width, entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerElement);
  };

  onUnmounted(() => {
    if (resizeObserver && containerElement) {
      resizeObserver.unobserve(containerElement);
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  return {
    elementSize,
    updateElementSize,
    bindRenderer
  };
};
