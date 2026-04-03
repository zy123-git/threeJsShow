<template>
  <div class="three-container">
    <canvas class="canvas_8"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { useElementSize } from '../utils/useElementSize';
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

const { elementSize, updateElementSize, bindRenderer } = useElementSize(".three-container");

// 初始化Three.js场景
const initThreeScene = () => {
  canvas = document.querySelector('canvas.canvas_8')

  // 使用画布尺寸组合函数
  updateElementSize()
  
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(75, elementSize.value.width / elementSize.value.height, 0.1, 1000);
  camera.position.z = 28; // 调整相机位置以适应50*50小间距粒子矩阵
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setClearColor('#181818');
  renderer.setSize(elementSize.value.width, elementSize.value.height, false); // false参数表示不更新DOM尺寸
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // 绑定响应式尺寸更新
  bindRenderer(renderer, camera);

  let displacement = { 
    canvas: null, 
    context: null, 
    glowImage: null,
    interactivePlane: null,
    raycaster: null,
    screenCursor: null,
    canvasCursor: null,
    canvasCursorPrevious: null,
    texture: null,
  };

  //2D 画布
  displacement.canvas = document.createElement('canvas');
  displacement.canvas.width = 128;
  displacement.canvas.height = 128;
  // place the debug canvas inside the three container so it aligns with the 3D canvas
  // use absolute positioning relative to the container instead of fixed to body
  displacement.canvas.style.position = 'absolute';
  displacement.canvas.style.top = '0';
  displacement.canvas.style.right = '0';
  displacement.canvas.style.width = '256px';
  displacement.canvas.style.height = '256px';
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
  displacement.glowImage.src = 'static/forParticles/glow.jpeg'

  // 射线投射器
  displacement.raycaster = new THREE.Raycaster()

  displacement.screenCursor = new THREE.Vector2(9999,9999)
  displacement.canvasCursor = new THREE.Vector2(9999,9999)
  displacement.canvasCursorPrevious = new THREE.Vector2(9999,9999)

  window.addEventListener('pointermove',(event) =>
  {
    displacement.screenCursor.x = ((event.clientX-260) / (elementSize.value.width)) * 2 - 1
    displacement.screenCursor.y = -((event.clientY) / elementSize.value.height) * 2 + 1
  })

  //轨迹纹理
  displacement.texture = new THREE.CanvasTexture(displacement.canvas)

  //用于射线投影的平面
  displacement.interactivePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(40,40),
    new THREE.MeshBasicMaterial({color:'red'})
  );
  displacement.interactivePlane.visible=false
  scene.add(displacement.interactivePlane);

  // 创建粒子系统，细分平面，在顶点上生成粒子
  particleGeometry = new THREE.PlaneGeometry(40, 40, 128, 128);
  //3js默认设置索引导致glsl绘制了更多的粒子
  particleGeometry.setIndex(null)
  //将平面的法线信息去掉，减少向gpu发送的信息
  particleGeometry.deleteAttribute('normal')

  //为粒子偏移创建随机值
  const intensitiesArray = new Float32Array(particleGeometry.attributes.position.count)
  const anglesArray = new Float32Array(particleGeometry.attributes.position.count)
  for(let i = 0; i < particleGeometry.attributes.position.count; i++){
    intensitiesArray[i] = Math.random()
    anglesArray[i] = Math.random() * Math.PI * 2
  }

  //glsl是每个粒子都要执行的文件，因此对于单个顶点用aIntensity单数形式
  particleGeometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensitiesArray, 1))
  particleGeometry.setAttribute('aAngle', new THREE.BufferAttribute(anglesArray, 1))

  const textureLoader = new THREE.TextureLoader();

  particleMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uResolution: new THREE.Uniform(new THREE.Vector2(elementSize.value.width * window.devicePixelRatio, 
      elementSize.value.height * window.devicePixelRatio)),
      uPictureTexture: new THREE.Uniform(textureLoader.load('/static/forParticles/desert.jpg')),
      uDisplacementTexture: new THREE.Uniform(displacement.texture),
    },
  });

  particles = new THREE.Points(particleGeometry, particleMaterial);
  
  scene.add(particles);
  
  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // 添加平行光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  const tick = () => {
    // 关键变量为空时不执行（组件已卸载）
    if (!scene || !camera || !renderer || !displacement.raycaster) {
      return;
    }

    displacement.raycaster.setFromCamera(displacement.screenCursor, camera)
    const intersections = displacement.raycaster.intersectObject(displacement.interactivePlane)

    if(intersections.length){
      const uv = intersections[0].uv

      displacement.canvasCursor.x = uv.x * displacement.canvas.width
      displacement.canvasCursor.y = (1-uv.y) * displacement.canvas.height

    }

    //轨迹变淡操作前，将globalCompositeOperation状态恢复为默认值
    displacement.context.globalCompositeOperation = 'source-over'
    //globalAlpha=0.1状态下绘制的图形不透明度为0.1
    displacement.context.globalAlpha=0.02
    //绘制新的光晕前用很淡的黑色矩形填充画布达到轨迹淡化的效果
    displacement.context.fillRect(0,0,displacement.canvas.width,displacement.canvas.height)

    //检测鼠标移动
    const cursorDistance = displacement.canvasCursorPrevious.distanceTo(displacement.canvasCursor)
    displacement.canvasCursorPrevious.copy(displacement.canvasCursor)
    const alpha = Math.min(cursorDistance * 0.1, 1);

    //绘制当前帧的光晕
    const glowSize = displacement.canvas.width * 0.25;
    displacement.context.globalCompositeOperation = 'lighten'
    displacement.context.globalAlpha = alpha
    displacement.context.drawImage(
      displacement.glowImage,
      displacement.canvasCursor.x - glowSize * 0.5,
      displacement.canvasCursor.y - glowSize * 0.5,
      glowSize,
      glowSize
    )

    displacement.texture.needsUpdate = true

    renderer.render(scene, camera);
    animationId = window.requestAnimationFrame(tick);
  }
  tick()
};

// 组件挂载时初始化
onMounted(async () => {
  // 等待DOM更新完成
  await nextTick();
  
  // 初始化Three.js场景
  initThreeScene();
});

// 组件卸载时清理资源
onUnmounted(() => {
  
  // 取消动画帧
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
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