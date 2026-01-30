<template>
  <div class="three-container">
    <canvas class="canvas_9"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap'
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { useCanvasSize } from '../utils/ThreeCanvasSize';
import vertexShader from '../shader/morphParticlesShader/vertexWithIncludes';
import fragmentShader from '../shader/morphParticlesShader/fragment.glsl?raw';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';

// Three.js核心对象
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let canvas = null;
let gui = null;
let controls = null;
let loader = null;

// 使用画布尺寸组合函数
const { sizes, updateSize } = useCanvasSize('.canvas_9');

// 初始化Three.js场景
const initThreeScene = () => {
  canvas = document.querySelector('.canvas_9')

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');

  gui = new GUI({width: 340});
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(75, sizes.value.width / sizes.value.height, 0.1, 1000);
  camera.position.z = 3; // 调整相机位置以适应50*50小间距粒子矩阵

  controls = new OrbitControls(camera,canvas)
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setClearColor('#181818');
  renderer.setSize(sizes.value.width, sizes.value.height, false); // false参数表示不更新DOM尺寸

  const particles = {
    geometry: null,
    material: null,
    positions: null,
    currentIndex: 0,
    progress: 0,
    morph: null,
    morph0: null,
    morph1: null,
    morph2: null,
    morph3: null,
    particleSize: null,
    mixColor1: new THREE.Color('#ff7300'),
    mixColor2: new THREE.Color('#0091ff'),
  }

  loader = new GLTFLoader();
    loader.load(
        'static/particleModel/particlesModel.gltf',
        (gltf)=>{
            let maxGeometryCount=0
            gltf.scene.children.forEach(child => {
                if(maxGeometryCount < child.geometry.attributes.position.count)
                    maxGeometryCount = child.geometry.attributes.position.count
            });

            particles.positions = []
            gltf.scene.children.forEach(child => {
                const aPositions = new Float32Array(3*maxGeometryCount)
                for(let i=0;i<maxGeometryCount;i++){
                    if(i < child.geometry.attributes.position.count){
                      aPositions[3*i]=child.geometry.attributes.position.array[3*i]
                      aPositions[3*i+1]=child.geometry.attributes.position.array[3*i+1]
                      aPositions[3*i+2]=child.geometry.attributes.position.array[3*i+2]
                    }else{
                        const mRandom = Math.floor(Math.random()*child.geometry.attributes.position.count)
                        aPositions[3*i]=child.geometry.attributes.position.array[3*mRandom]
                        aPositions[3*i+1]=child.geometry.attributes.position.array[3*mRandom+1]
                        aPositions[3*i+2]=child.geometry.attributes.position.array[3*mRandom+2]
                    }
                }
                particles.positions.push(new THREE.Float32BufferAttribute(aPositions, 3))
            });

            const newArray = new Float32Array(maxGeometryCount)
            for(let i=0;i<maxGeometryCount;i++){
                newArray[i] = Math.random() + 1
            }
            particles.particleSize = new THREE.Float32BufferAttribute(newArray, 1)

            // 设置目标位置attribute
            particles.geometry = new THREE.BufferGeometry()
            particles.geometry.setIndex(null)
            particles.geometry.setAttribute('position', particles.positions[particles.currentIndex])
            particles.geometry.setAttribute('aTargetPosition', particles.positions[1])
            particles.geometry.setAttribute('aParticleSize', particles.particleSize)

            particles.material = new THREE.ShaderMaterial({
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                uniforms:
                {
                    uSize: new THREE.Uniform(0.1),
                    uResolution: new THREE.Uniform(new THREE.Vector2(sizes.value.width,sizes.value.height)),
                    uProgress: new THREE.Uniform(particles.progress),
                    uMixColor1: new THREE.Uniform(particles.mixColor1),
                    uMixColor2: new THREE.Uniform(particles.mixColor2)
                },
                blending:THREE.AdditiveBlending,
                depthWrite:false
            });

            const mParticles = new THREE.Points(particles.geometry,particles.material)

            scene.add(mParticles)

            particles.morph = (index: number) => {
              particles.geometry.attributes.position = particles.positions[particles.currentIndex]
              particles.geometry.attributes.aTargetPosition = particles.positions[index]

              gsap.fromTo(
                particles.material.uniforms.uProgress,
                {value: 0},
                {value: 1, duration: 3, ease: 'linear'}
              )

              particles.currentIndex = index
            }

            particles.morph0 = () => {particles.morph(0)}
            particles.morph1 = () => {particles.morph(1)}
            particles.morph2 = () => {particles.morph(2)}
            particles.morph3 = () => {particles.morph(3)}

            gui.addColor(scene, 'background')
            gui
              .add(particles, 'progress')
              .min(0)
              .max(1)
              .step(0.001)
              .name('进度')
              .onChange(() => {
                  particles.material.uniforms.uProgress.value = particles.progress
              })
              
            gui.add(particles, 'morph0')
            gui.add(particles, 'morph1')
            gui.add(particles, 'morph2')
            gui.add(particles, 'morph3')
            gui.addColor(particles, 'mixColor1')
            gui.addColor(particles, 'mixColor2')
        }
    )

  const tick = () => {

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
      window.requestAnimationFrame(tick);
    }
  }
  tick()
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
  
  // 清理GUI
  if (gui) {
    // 尝试手动从DOM中移除gui元素
    if (gui.domElement && gui.domElement.parentNode) {
      gui.domElement.parentNode.removeChild(gui.domElement);
    }
    // 调用destroy方法
    gui.destroy();
    gui = null;
  }
  
  // 清理控制器
  if (controls) {
    controls.dispose();
    controls = null;
  }
  
  // 清理渲染器
  if (renderer) {
    if (renderer.domElement && renderer.domElement.parentNode) {
      (renderer.domElement.parentNode as HTMLElement).removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer = null;
  }
  
  // 清理加载器
  loader = null;
  
  // 清理画布引用
  canvas = null;
  
  // 清理相机和场景引用
  camera = null;
  scene = null;
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