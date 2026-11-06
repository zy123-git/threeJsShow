<template>
  <div class="three-container">
    <canvas class="canvas_8"></canvas>
  </div>
</template>

<script setup lang="ts">
/*下一步：
1.通过PS扣出图片中的浪花部分，生成黑底或白底图
2.将生成的图导入glsl，通过texture函数解析出浪花位置信息
3.为代表浪花的粒子添加动态效果*/

import { onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { disposeObject3D } from './shared/dispose';
import { useThreeScene, type ThreeSceneContext } from './shared/useThreeScene';
import vertexShader from '../shader/particlesShader/vertex.glsl?raw';
import fragmentShader from '../shader/particlesShader/fragment.glsl?raw';

// Three.js核心对象
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let renderFrame: (() => void) | null = null;

// 粒子相关变量
let particleGeometry: THREE.BufferGeometry | null = null;
let particleMaterial: THREE.ShaderMaterial | null = null;
let particles: THREE.Points | null = null;
let particleCount = 10000;

// 初始化Three.js场景
const initThreeScene = (ctx: ThreeSceneContext) => {
  ({ scene, camera, renderer } = ctx);
  const { elementSize } = ctx;

  // 创建场景背景
  scene.background = new THREE.Color(0x050505);

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
  particleGeometry = new THREE.PlaneGeometry(40, 40, 256, 256);
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
      uPictureTexture: new THREE.Uniform(textureLoader.load('/static/forParticles/waves2.jpg')),
      uDisplacementTexture: new THREE.Uniform(displacement.texture),
    },
  });

  particles = new THREE.Points(particleGeometry, particleMaterial);
  
  // scene.add(particles);

  const aGeometry = new THREE.PlaneGeometry(10, 10 ,5 , 5)
  const aMaterial = new THREE.PointsMaterial({
    size: 1
  })
  const aPlane = new THREE.Points(aGeometry, aMaterial)
  scene.add(aPlane)

  let frameCount = 0;

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

    // //轨迹变淡操作前，将globalCompositeOperation状态恢复为默认值
    // displacement.context.globalCompositeOperation = 'source-over'
    // //globalAlpha=0.1状态下绘制的图形不透明度为0.1
    // displacement.context.globalAlpha=0.02
    // //绘制新的光晕前用很淡的黑色矩形填充画布达到轨迹淡化的效果
    // displacement.context.fillRect(0,0,displacement.canvas.width,displacement.canvas.height)

    // 每两帧执行一次
    frameCount++;
    if (frameCount % 2 === 0) {
      //轨迹变淡操作前，将globalCompositeOperation状态恢复为默认值
      displacement.context.globalCompositeOperation = 'source-over'
      //globalAlpha=0.1状态下绘制的图形不透明度为0.1
      displacement.context.globalAlpha=0.02
      //绘制新的光晕前用很淡的黑色矩形填充画布达到轨迹淡化的效果
      displacement.context.fillRect(0,0,displacement.canvas.width,displacement.canvas.height)
    }

    //检测鼠标移动
    const cursorDistance = displacement.canvasCursorPrevious.distanceTo(displacement.canvasCursor)
    displacement.canvasCursorPrevious.copy(displacement.canvasCursor)
    const alpha = Math.min(cursorDistance * 0.1, 1);

    //绘制当前帧的光晕
    const glowSize = displacement.canvas.width * 0.2;
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
  }

  renderFrame = tick;
};

const three = useThreeScene({
  canvas: 'canvas.canvas_8',
  camera: { fov: 75, near: 0.1, far: 1000, position: [0, 0, 28] },
  renderer: {
    alpha: true,
    clearColor: '#181818',
    updateStyle: false,
    pixelRatio: window.devicePixelRatio
  },
  onInit: (ctx) => initThreeScene(ctx),
  onFrame: () => renderFrame?.(),
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
  // 清理粒子系统
  if (particles && scene) {
    scene.remove(particles);
  }

  // 清理几何体和材质（粒子未加入场景，需单独释放）
  disposeObject3D(particles);
  particleGeometry = null;
  particleMaterial = null;

  // 清理相机和场景引用
  camera = null;
  scene = null;
  particles = null;

  // 组合式统一释放场景、控制器与渲染器
  three.dispose();
});
</script>