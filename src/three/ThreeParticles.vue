<template>
  <div class="three-container">
    <canvas class="canvas_8"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { useCanvasSize } from '../utils/ThreeCanvasSize';
import vertexShader from '../shader/particlesShader/vertex.glsl?raw';
import fragmentShader from '../shader/particlesShader/fragment.glsl?raw';

// Three.js核心对象
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let animationId: number | null = null;
let canvas = null;

// 粒子相关变量
let particleGeometry: THREE.BufferGeometry | null = null;
let particleMaterial: THREE.ShaderMaterial | null = null;
let particles: THREE.Points | null = null;
let particleCount = 10000;

// 使用画布尺寸组合函数
const { size, updateSize } = useCanvasSize('.three-container');

// 初始化Three.js场景
const initThreeScene = () => {

  canvas = document.querySelector('.canvas_8')!;
  // 使用响应式尺寸
  const { width, height } = size.value;
  
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 28; // 调整相机位置以适应50*50小间距粒子矩阵
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setSize(width, height, false); // false参数表示不更新DOM尺寸
  renderer.setPixelRatio(window.devicePixelRatio);
  
  
  // 创建粒子系统
  createParticleSystem();
  
  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // 添加平行光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
};

// 创建粒子系统
const createParticleSystem = () => {
  if (!scene) return;

  const particlesGeometry = new THREE.PlaneGeometry(40, 40, 128, 128);

  const textureLoader = new THREE.TextureLoader();

  const particlesMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      
      uResolution: new THREE.Uniform(new THREE.Vector2(size.value.width * window.devicePixelRatio, 
      size.value.height * window.devicePixelRatio)),
      uPictureTexture: new THREE.Uniform(textureLoader.load('/png/carrier.png')),
    },
  });

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  
  scene.add(particles);
};

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate);
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
};

// 处理窗口大小变化
const handleResize = () => {
  if (!canvas || !camera || !renderer) return;
  
  // 使用组合函数更新尺寸
  updateSize();
  
  // 更新canvas元素尺寸
  if (canvas) {
    canvas.style.width = `${size.value.width}px`;
    canvas.style.height = `${size.value.height}px`;
  }
  
  // 更新相机和渲染器
  camera.aspect = size.value.width / size.value.height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(size.value.width, size.value.height, false); // false参数表示不更新DOM尺寸
};

// 组件挂载时初始化
onMounted(async () => {
  // 等待DOM更新完成
  await nextTick();
  
  // 初始化Three.js场景
  initThreeScene();
  animate();
  
  // 监听窗口大小变化
  // 注意：useCanvasSize已经处理了resize事件，但我们保留这个以便于可能的额外处理
  window.addEventListener('resize', handleResize);
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 停止动画循环
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // 移除事件监听
  window.removeEventListener('resize', handleResize);
  
  // 释放Three.js资源
  
  // 清理粒子系统
  if (particles && scene) {
    scene.remove(particles);
  }
  
  // 清理几何体
  if (particleGeometry) {
    particleGeometry.dispose();
    particleGeometry = null;
  }
  
  // 清理材质
  if (particleMaterial) {
    particleMaterial.dispose();
    particleMaterial = null;
  }
  
  // 清理渲染器
  if (renderer) {
    if (renderer.domElement && renderer.domElement.parentNode) {
      (renderer.domElement.parentNode as HTMLElement).removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer = null;
  }
  
  // 清理相机和场景引用
  camera = null;
  scene = null;
  particles = null;
});
</script>

<style scoped>
/* 主容器样式 */
.three-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0; /* 确保在导航栏下方 */
  /* 通过JS动态计算顶部偏移量，这里设置一个默认值 */
}

/* Canvas样式 */
.canvas_8 {
  display: block;
  width: 100%;
  height: 100%;
}
</style>