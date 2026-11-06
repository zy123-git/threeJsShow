<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="canvas_9"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap'
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { useThreeScene, type ThreeSceneContext } from './shared/useThreeScene';
import vertexShader from '../shader/morphParticlesShader/vertexWithIncludes';
import fragmentShader from '../shader/morphParticlesShader/fragment.glsl?raw';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';
import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';
import { destroyGui } from './shared/gui';

// Three.js核心对象
const canvasRef = ref<HTMLCanvasElement | null>(null);
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let renderFrame: (() => void) | null = null;
let gui = null;
let loader = null;

// 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
const assetToken = beginAssetLoading();

// 初始化Three.js场景
const initThreeScene = (ctx: ThreeSceneContext) => {
  ({ scene, camera, renderer } = ctx);
  const { elementSize } = ctx;

  // 创建场景背景
  scene.background = new THREE.Color('#000000');

  gui = new GUI({width: 340});

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
            endAssetLoading(assetToken);
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
                    uResolution: new THREE.Uniform(new THREE.Vector2(elementSize.value.width,elementSize.value.height)),
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
        },
        (xhr) => {
            reportAssetProgress(assetToken, xhr.loaded, xhr.total)
        },
        (error) => {
            endAssetLoading(assetToken)
            console.error('粒子模型加载失败:', error)
        }
    )

  /**
   * 帧更新(动画)
   */
  renderFrame = () => {
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
};

const three = useThreeScene({
  canvas: canvasRef,
  camera: { fov: 75, near: 0.1, far: 1000, position: [0, 0, 3] },
  controls: {},
  renderer: { alpha: true, clearColor: '#181818', updateStyle: false },
  onInit: (ctx) => initThreeScene(ctx),
  onFrame: () => renderFrame?.(),
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
  // 清理GUI
  if (gui) {
    destroyGui(gui);
    gui = null;
  }

  // 清理加载器
  loader = null;

  // 清理相机和场景引用
  camera = null;
  scene = null;

  // 组合式统一释放场景、控制器与渲染器
  three.dispose();
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