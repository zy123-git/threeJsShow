<template>
  <div class="three-container">
    <canvas class="webgl"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import * as dat from 'dat.gui';
import { Material } from 'three';
import gsap from 'gsap';
import { useElementSize } from '../utils/useElementSize';

let gui = null;
let renderer = null;
let scene = null;
let camera = null;
let animationId = null;
let scrollY = 0;
let currentSection = 0;
let scrollContainer = null;
let handleScroll = null;

const initThree = () => {
  // 使用画布尺寸组合函数
  const { elementSize, updateElementSize, bindRenderer } = useElementSize('.three-container');
  
  // 设置容器位置和尺寸
  updateElementSize();

  /**
   * 调试
   */
  // 初始化dat.GUI
  gui = new dat.GUI();

  const parameters = {
    materialColor: 0x881c98,
  };

  gui.addColor(parameters, 'materialColor').onChange(() => {
    material.color.set(parameters.materialColor);
  });

  /**
   * 场景
   */
  //Canvas
  const canvas = document.querySelector('canvas.webgl');

  // 监听main元素的滚动事件（因为App.vue中main是滚动容器）
  scrollContainer = document.querySelector('main') || window;
  
  handleScroll = () => {
    scrollY = scrollContainer.scrollTop || window.scrollY;

    const newSection = Math.round(scrollY / window.innerHeight);

    if (newSection != currentSection) {
      currentSection = newSection;

      gsap.to(sectionMeshes[currentSection].rotation, {
        duration: 1.5,
        ease: 'power2.inOut',
        x: '+=4',
        y: '+=2',
        z: '+=1',
      });
    }
  };

  // 添加滚动监听
  scrollContainer.addEventListener('scroll', handleScroll);

  // 场景
  scene = new THREE.Scene();

  /**
   * 物体
   */
  //纹理
  // const textureLoader = new THREE.TextureLoader();
  // const gradientTexture = textureLoader.load('/static/textures/texture_1.png');
  // gradientTexture.magFilter = THREE.NearestFilter;

  //材质

  const material = new THREE.MeshToonMaterial({
    color: parameters.materialColor,
    // gradientMap: gradientTexture,
  });

  //网格

  //物体间的标准距离
  const objectsDistance = 4;

  const mesh1 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.4, 16, 60), material);
  const mesh2 = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 32), material);
  const mesh3 = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.35, 100, 16), material);

  mesh1.scale.set(0.5, 0.5, 0.5);
  mesh2.scale.set(0.5, 0.5, 0.5);
  mesh3.scale.set(0.5, 0.5, 0.5);

  mesh1.position.y = objectsDistance * 0;
  mesh2.position.y = objectsDistance * -1;
  mesh3.position.y = objectsDistance * -2;

  mesh1.position.x = objectsDistance * 0.4;
  mesh2.position.x = objectsDistance * -0.4;
  mesh3.position.x = objectsDistance * 0.4;

  scene.add(mesh1, mesh2, mesh3);

  const sectionMeshes = [mesh1, mesh2, mesh3];

  /**
   * 粒子
   */
  const particlesCount = 400;
  const particlesPosition = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount; i++) {
    particlesPosition[i * 3 + 0] = (Math.random() - 0.5) * 8;
    particlesPosition[i * 3 + 1] =
      objectsDistance * 0.5 - Math.random() * objectsDistance * sectionMeshes.length;
    particlesPosition[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }

  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPosition, 3));

  //粒子材质
  const particlesMaterial = new THREE.PointsMaterial({
    color: parameters.materialColor,
    sizeAttenuation: true,
    size: 0.03,
  });

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  /**
   * 光线
   */
  const directionalLight = new THREE.DirectionalLight('#ffffff', 1);
  directionalLight.position.set(1, 1, 0.25);
  scene.add(directionalLight);

  // 相机组
  const cameraGroup = new THREE.Group();
  scene.add(cameraGroup);

  camera = new THREE.PerspectiveCamera(35, elementSize.value.width / elementSize.value.height, 0.1, 1000);
  camera.position.z = 6;
  cameraGroup.add(camera);

  // 渲染器
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
  });

  renderer.setClearColor(0x000000, 0); // 设置清除颜色为完全透明
  renderer.setSize(elementSize.value.width, elementSize.value.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // 绑定响应式尺寸更新
  bindRenderer(renderer, camera);

  //鼠标位置
  const cursor = {
    x: 0,
    y: 0,
  };

  //鼠标移动监听
  window.addEventListener('mousemove', (event) => {
    cursor.x = event.clientX / window.innerWidth - 0.5;
    cursor.y = event.clientY / window.innerHeight - 0.5;
  });

  /**
   * 帧更�?动画)
   */
  const clock = new THREE.Clock();
  let previousTime = 0;

  const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    // 相机动画
    camera.position.y = (scrollY / window.innerHeight) * objectsDistance * -1;

    //视差
    const parallaxX = cursor.x;
    const parallaxY = -cursor.y;

    cameraGroup.position.x += (parallaxX - cameraGroup.position.x) * 5 * deltaTime;
    cameraGroup.position.y += (parallaxY - cameraGroup.position.y) * 5 * deltaTime;

    //物体动画
    for (const mesh of sectionMeshes) {
      mesh.rotation.x += deltaTime * 0.1;
      mesh.rotation.y += deltaTime * 0.12;
    }

    // 渲染
    //这是整个流程的最后一步，在帧更新中渲染即可，
    renderer.render(scene, camera);

    // 继续调用 tick 函数
    animationId = window.requestAnimationFrame(tick);
  };

  // 启动动画循环
  animationId = window.requestAnimationFrame(tick);
};

onMounted(() => {
  initThree();
});

onBeforeUnmount(() => {
  if (gui) {
    gui.destroy();
  }

  // 清理Three.js资源
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }

  if (animationId) {
    window.cancelAnimationFrame(animationId);
  }

  // 移除事件监听
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll);
  }

  // 清理场景中的对象
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
});
</script>

<style>
.three-container {
  position: fixed;
  top: 0;
  
  z-index: -1;
  pointer-events: none; /* 禁用所有鼠标事�?*/
  user-select: none; /* 禁止文本选择 */

}
</style>
