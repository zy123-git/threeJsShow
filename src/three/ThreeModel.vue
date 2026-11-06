<template>
  <div Ref="containerRef" class="three-container">
    <canvas class="webgl_2"></canvas>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';
import { useThreeScene } from './shared/useThreeScene';

let scene = null;
let camera = null;
let renderer = null;
let renderFrame = null;

// 存储需要动画的网格对象引用
let ring1: THREE.Object3D | null = null;
let ring2: THREE.Object3D | null = null;
let ring3: THREE.Object3D | null = null;
let ring4: THREE.Object3D | null = null;
let crossRing: THREE.Object3D | null = null;
let coreRing: THREE.Object3D | null = null;
let energyShield: THREE.Object3D | null = null;

// 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
const assetToken = beginAssetLoading();

const initThree = (ctx) => {
  ({ scene, camera, renderer } = ctx);

  scene.add(camera);

  /**
   * 地面
   */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
  );

  floor.rotation.x = -Math.PI / 2;
  // scene.add(floor);

  /**
   * 模型
   */
  const gltfLoader = new GLTFLoader();
  // gltfLoader.load(
  //   'static/celestail_hub/celestail_hub.glb',
  //   (gltf) => {
  //     const model = gltf.scene;

  //     // 设置模型位置
  //     model.position.set(0, 0, 0);
  //     console.log(model)
  //      model.traverse((child) => {
  //       console.log(child)
  //      })

  //     // 遍历模型，查找需要添加动画的网格对象
  //     model.traverse((child) => {
  //       if ((child as THREE.Mesh).isMesh) {
  //         switch (child.name) {
  //           case '环1_Baked':
  //             ring1 = child;
  //             console.log('找到环1');
  //             break;
  //           case '环2_Baked':
  //             ring2 = child;
  //             console.log('找到环2');
  //             break;
  //           case '环3_Baked':
  //             ring3 = child;
  //             console.log('找到环3');
  //             break;
  //           case '环4_Baked':
  //             ring4 = child;
  //             console.log('找到环4');
  //             break;
  //           case '十字圆环_Baked':
  //             crossRing = child;
  //             console.log('找到十字圆环');
  //             break;
  //           case '核心环_Baked':
  //             coreRing = child;
  //             console.log('找到核心环');
  //             break;
  //           case '防护罩_Baked':
  //             energyShield = child;
  //             console.log('找到防护罩');
  //             break;
  //         }
  //       }
  //     });

  //     scene.add(model);
  //     console.log('celestail_hub 模型加载成功');
  //   },
  //   (xhr) => {
  //     console.log(`加载进度: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
  //   },
  //   (error) => {
  //     console.error('模型加载错误:', error);
  //   }
  // );

  gltfLoader.load(
    "static/classroom/deskChairMini.glb",
    (gltf) => {
      endAssetLoading(assetToken);
      const model = gltf.scene;

      // 设置模型位置
      model.position.set(0, 0, 0);
      model.traverse((child) => {
        console.log(child)
       })

      scene.add(model);
      console.log('教室模型加载成功');
    },
    (xhr) => {
      reportAssetProgress(assetToken, xhr.loaded, xhr.total);
    },
    (error) => {
      endAssetLoading(assetToken);
      console.error('教室模型加载失败:', error);
    }
  )

  /**
   * 光照
   */
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 4);
  scene.add(ambientLight);

  // 点光源
  const pointLight = new THREE.PointLight(0xffffff, 4);
  pointLight.position.set(0, 1, 0);
  scene.add(pointLight);

  let elapsedTime = 0;

  /**
   * 帧更新(动画)
   */
  renderFrame = (deltaTime) => {
    elapsedTime += deltaTime;

    // 为各个网格对象添加旋转动画
    animateRings(elapsedTime, deltaTime);

    // 渲染
    renderer.render(scene, camera);
  };
}

/**
 * 为各个环添加旋转动画效果
 * 增加复杂的组合轴向旋转和变化速度
 */
const animateRings = (elapsedTime: number, deltaTime: number) => {
  // 环1: X+Y+Z三轴组合旋转，每个轴使用不同频率的正弦波，速度范围1.5-2.5
  if (ring1) {
    const speed1 = 1.5 + Math.sin(elapsedTime * 1.3) * 0.5;
    const speed2 = 1.0 + Math.cos(elapsedTime * 0.7) * 0.3;
    const speed3 = 0.8 + Math.sin(elapsedTime * 1.8) * 0.2;
    ring1.rotation.x += speed1 * deltaTime;
    ring1.rotation.y += speed2 * deltaTime;
    ring1.rotation.z += speed3 * deltaTime;
  }

  // 环2: Y+Z组合轴，使用多频率cos波叠加，速度范围0.5-2.5
  if (ring2) {
    const speedY = 1.5 + Math.cos(elapsedTime * 1.2) * 0.5 + Math.sin(elapsedTime * 2.3) * 0.3;
    const speedZ = 1.2 + Math.sin(elapsedTime * 0.9) * 0.4 + Math.cos(elapsedTime * 1.7) * 0.2;
    ring2.rotation.y += speedY * deltaTime;
    ring2.rotation.z += speedZ * deltaTime;
    // 添加微小的X轴扰动增加随机性
    ring2.rotation.x += Math.sin(elapsedTime * 3.1) * 0.1 * deltaTime;
  }

  // 环3: X+Y+Z三轴同时旋转，主旋转轴周期性切换，速度范围1.0-2.0
  if (ring3) {
    const phaseShift = elapsedTime * 0.5;
    const primaryAxis = Math.floor((elapsedTime * 0.3) % 3);
    const baseSpeed = 1.0 + Math.sin(elapsedTime * 1.1) * 0.5;

    // 根据时间在三个轴之间动态分配主要速度
    const xSpeed = (primaryAxis === 0 ? baseSpeed * 1.5 : baseSpeed * 0.3) + Math.cos(elapsedTime * 2.1) * 0.2;
    const ySpeed = (primaryAxis === 1 ? baseSpeed * 1.5 : baseSpeed * 0.3) + Math.sin(elapsedTime * 1.6) * 0.2;
    const zSpeed = (primaryAxis === 2 ? baseSpeed * 1.5 : baseSpeed * 0.3) + Math.cos(elapsedTime * 0.8) * 0.2;

    ring3.rotation.x += xSpeed * deltaTime;
    ring3.rotation.y += ySpeed * deltaTime;
    ring3.rotation.z += zSpeed * deltaTime;
  }

  // 环4: X+Y组合轴，使用多频率正弦波叠加产生不规则变化，速度范围1.5-3.0
  if (ring4) {
    const speedX = 2.0 + Math.sin(elapsedTime * 1.4) * 0.5 + Math.sin(elapsedTime * 2.7) * 0.3 + Math.cos(elapsedTime * 3.2) * 0.2;
    const speedY = 1.5 + Math.cos(elapsedTime * 0.9) * 0.4 + Math.cos(elapsedTime * 2.1) * 0.3 + Math.sin(elapsedTime * 1.3) * 0.2;
    ring4.rotation.x += speedX * deltaTime;
    ring4.rotation.y += speedY * deltaTime;
    // Z轴微小扰动
    ring4.rotation.z += Math.sin(elapsedTime * 4.1) * 0.15 * deltaTime;
  }

  // 十字圆环: X+Y+Z三轴复杂组合，使用高频波动，速度范围2.0-3.5
  if (crossRing) {
    const speedX = 2.5 + Math.sin(elapsedTime * 1.8) * 0.5 + Math.cos(elapsedTime * 2.5) * 0.3;
    const speedY = 2.0 + Math.cos(elapsedTime * 1.3) * 0.4 + Math.sin(elapsedTime * 2.9) * 0.3;
    const speedZ = 1.8 + Math.sin(elapsedTime * 2.2) * 0.4 + Math.cos(elapsedTime * 1.6) * 0.3;
    crossRing.rotation.x += speedX * deltaTime;
    crossRing.rotation.y += speedY * deltaTime;
    crossRing.rotation.z += speedZ * deltaTime;
  }

  // 核心环: 绕Z轴，恒定速度1.5弧度/秒，顺时针旋转
  if (coreRing) {
    coreRing.rotation.y -= 1.5 * deltaTime;
  }

  // 能量罩: 绕Z轴，恒定速度1.5弧度/秒，顺时针旋转（与核心环同步）
  if (energyShield) {
    energyShield.rotation.y -= 1.5 * deltaTime;
  }
}

const three = useThreeScene({
  canvas: 'canvas.webgl_2',
  camera: { fov: 75, near: 0.1, far: 100, position: [1, 1, -1] },
  controls: { enableDamping: true },
  renderer: {
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    clearColor: 0x000000
  },
  onInit: (ctx) => initThree(ctx),
  onFrame: (_ctx, frame) => renderFrame?.(frame.delta),
});

onBeforeUnmount(() => {
  // 清空引用
  ring1 = null;
  ring2 = null;
  ring3 = null;
  ring4 = null;
  crossRing = null;
  coreRing = null;
  energyShield = null;

  // 组合式统一释放场景、控制器与渲染器
  three.dispose();
});
</script>

<style scoped>
.three-container {
  width: 100%;
  height: 100%;
}
</style>
