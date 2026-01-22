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
  const { sizes, updateSize } = useCanvasSize('.canvas_8');

// 初始化Three.js场景
const initThreeScene = () => {
  canvas = document.querySelector('.canvas_8')
  
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(75, sizes.value.width / sizes.value.height, 0.1, 1000);
  camera.position.z = 28; // 调整相机位置以适应50*50小间距粒子矩阵
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setClearColor('#181818');
  renderer.setSize(sizes.value.width, sizes.value.height, false); // false参数表示不更新DOM尺寸
  renderer.setPixelRatio(window.devicePixelRatio);

  const displacement = { 
    canvas: null, 
    context: null, 
    glowImage: null,
    interactivePlane: null,
    raycaster: null,
    screenCursor: null,
    canvasCursor: null,
  };

  //2D 画布
  displacement.canvas = document.createElement('canvas');
  displacement.canvas.width = 128;
  displacement.canvas.height = 128;
  // place the debug canvas inside the three container so it aligns with the 3D canvas
  // use absolute positioning relative to the container instead of fixed to body
  displacement.canvas.style.position = 'absolute';
  displacement.canvas.style.top = '0';
  displacement.canvas.style.left = '0';
  displacement.canvas.style.width = '512px';
  displacement.canvas.style.height = '512px';
  displacement.canvas.style.zIndex = '10';
  displacement.canvas.style.pointerEvents = 'none'; // allow pointer events to pass through
  const threeContainerEl = document.querySelector('.three-container');
  if (threeContainerEl) {
    threeContainerEl.appendChild(displacement.canvas);
  } else {
    // fallback to body if container not found
    document.body.appendChild(displacement.canvas);
  }
  
  displacement.context = displacement.canvas.getContext('2d')!
  displacement.context.fillRect(0, 0, displacement.canvas.width, displacement.canvas.height)

  displacement.glowImage = new Image()
  displacement.glowImage.src = '/png/glow.svg'

  //投射器
  displacement.raycaster = new THREE.Raycaster()

  displacement.screenCursor = new THREE.Vector2(9999,9999)
  displacement.canvasCursor = new THREE.Vector2(9999,9999)

  window.addEventListener('pointermove',(event) =>
  {
    displacement.screenCursor.x = (event.clientX / sizes.value.width) * 2 - 1
    displacement.screenCursor.y = -((event.clientY - sizes.value.navbarHeight) / sizes.value.height) * 2 + 1
  })

  displacement.interactivePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(40,40),
    new THREE.MeshBasicMaterial({color:'red'})
  );
  scene.add(displacement.interactivePlane);

  // 创建粒子系统
  createParticleSystem();
  
  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // 添加平行光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  const tick = () => {

    displacement.raycaster.setFromCamera(displacement.screenCursor, camera)
    const intersections = displacement.raycaster.intersectObject(displacement.interactivePlane)

    if(intersections.length){
      const uv = intersections[0].uv

      displacement.canvasCursor.x = uv.x * displacement.canvas.width
      displacement.canvasCursor.y = (1-uv.y) * displacement.canvas.height

      console.log("displacement.canvasCursor:",displacement.canvasCursor)
    }

    const glowSize = displacement.canvas.width * 0.25;
    displacement.context.globalCompositeOperation = 'lightn'
    displacement.context.drawImage(
      displacement.glowImage,
      displacement.canvasCursor.x - glowSize * 0.5,
      displacement.canvasCursor.y - glowSize * 0.5,
      glowSize,
      glowSize
    )

    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
  }
  tick()
};

// 创建粒子系统
const createParticleSystem = () => {
  if (!scene) return;

  const particlesGeometry = new THREE.PlaneGeometry(40, 40, 256, 256);

  const textureLoader = new THREE.TextureLoader();

  const particlesMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uResolution: new THREE.Uniform(new THREE.Vector2(sizes.value.width * window.devicePixelRatio, 
      sizes.value.height * window.devicePixelRatio)),
      uPictureTexture: new THREE.Uniform(textureLoader.load('/png/dragon.png')),
    },
  });

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  
  scene.add(particles);
};

// 处理窗口大小变化
const handleResize = () => {
  if (!canvas || !camera || !renderer) return;
  
  // 使用组合函数更新尺寸
  updateSize();
  
  // 更新canvas元素尺寸
  if (canvas) {
    canvas.style.width = `${sizes.value.width}px`;
    canvas.style.height = `${sizes.value.height}px`;
  }
  
  // 更新相机和渲染器
  camera.aspect = sizes.value.width / sizes.value.height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(sizes.value.width, sizes.value.height, false); // false参数表示不更新DOM尺寸
};

// 组件挂载时初始化
onMounted(async () => {
  // 等待DOM更新完成
  await nextTick();
  
  // 初始化Three.js场景
  initThreeScene();
  
  // 监听窗口大小变化
  // 注意：useCanvasSize已经处理了resize事件，但我们保留这个以便于可能的额外处理
  window.addEventListener('resize', handleResize);
});

// 组件卸载时清理资源
onUnmounted(() => {

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
/* Canvas样式 */
.canvas_8 {
  display: block;
  width: 100%;
  height: 100%;
}
</style>