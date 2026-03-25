<template>
  <div Ref="containerRef" class="three-container">
    <canvas class="webgl_2"></canvas>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useElementSize } from '../utils/useElementSize';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


let canvas = null
let scene=null
let camera=null
let renderer=null
let threeModel=null
let controls=null

const initThree= ()=> {
  
  // 设置容器位置和尺�?
  // updateSize();
  /**
   * 场景环境设置
   */
  //画布
  canvas = document.querySelector('canvas.webgl_2');

  // 使用画布尺寸组合函数
  const { elementSize, updateElementSize, bindRenderer } = useElementSize('.three-container');
  updateElementSize();

  // 场景
  scene = new THREE.Scene();

   /**
   * 相机
   */
   camera = new THREE.PerspectiveCamera(75, elementSize.value.width / elementSize.value.height, 0.1, 100);
   camera.position.set(0.0 ,0.2, 1);
   scene.add(camera);
   //相机控制
   controls = new OrbitControls(camera, canvas);
   
   controls.enableDamping = true;

  // 相机�?

  /**
   * 地面
   */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
  );
  
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const textureLoader = new THREE.TextureLoader();

  // 纹理映射表，根据网格名称匹配对应的纹�?
  const textureMap = {
    'Body': 'static/cool_man/textures/Wolf3D_Body.003_baseColor.png',
    'Eye': 'static/cool_man/textures/Wolf3D_Eye.003_baseColor.jpeg',
    'Glasses': 'static/cool_man/textures/Wolf3D_Glasses.003_baseColor.png',
    'Hair': 'static/cool_man/textures/Wolf3D_Hair.003_baseColor.png',
    'Outfit_Bottom': 'static/cool_man/textures/Wolf3D_Outfit_Bottom.003_baseColor.jpeg',
    'Outfit_Footwear': 'static/cool_man/textures/Wolf3D_Outfit_Footwear.003_baseColor.jpeg',
    'Outfit_Top': 'static/cool_man/textures/Wolf3D_Outfit_Top.003_baseColor.jpeg',
    'Skin': 'static/cool_man/textures/Wolf3D_Skin.003_baseColor.jpeg',
    'Teeth': 'static/cool_man/textures/Wolf3D_Teeth.003_baseColor.jpeg'
  };

  /**
   * 模型
   */
  threeModel = new GLTFLoader();
  threeModel.load(
    'static/cool_man/cool_man.gltf',
    (gltf) => {
      const model = gltf.scene;
      
      // 设置模型位置
      model.position.set(0, 0, 0);

      // 遍历模型，应用纹�?
      model.traverse((child) => {
        if (child.isMesh) {
          // 尝试根据网格名称匹配纹理
          let texturePath = null;
          for (const [key, path] of Object.entries(textureMap)) {
            if (child.name.includes(key)) {
              texturePath = path;
              break;
            }
          }

          if (texturePath) {
            // 加载并应用纹�?
            const texture = textureLoader.load(texturePath);
            texture.flipY = false;
            texture.colorSpace = THREE.SRGBColorSpace;

            if (Array.isArray(child.material)) {
              // 处理材质数组
              child.material.forEach((material) => {
                material.map = texture;
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
              });
            } else if (child.material) {
              // 处理单个材质
              child.material.map = texture;
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }

            console.log(`为网�?${child.name} 应用纹理: ${texturePath}`);
          } else {
            console.log(`未找到网�?${child.name} 对应的纹理`);
          }
        }
      });

      scene.add(model);
      console.log('cool_man模型加载成功，纹理已应用');
    },
    (xhr) => {
      console.log(`加载进度: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
    },
    (error) => {
      console.error('模型加载错误:', error);
    }
  );
  


  /**
   * 光照
   */
  // 环境�?
  const ambientLight = new THREE.AmbientLight(0xffffff, 2);
  scene.add(ambientLight);

  // 点光�?
  // const pointLight = new THREE.PointLight(0xffffff, 3);
  // pointLight.position.set(0, 1, 0);
  // scene.add(pointLight);

  // 渲染�?
  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(elementSize.value.width, elementSize.value.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000); // 设置背景颜色为黑�?
  
  // 绑定响应式尺寸更�?
  bindRenderer(renderer, camera);

  const clock = new THREE.Clock();
  const tick = () => {
    const elapsedTime = clock.getElapsedTime();

    // 渲染
    //这是整个流程的最后一步，在帧更新中渲染即可，
    renderer.render(scene, camera);

    // 继续调用 tick 函数
    requestAnimationFrame(tick);
  };
  tick();
}

onMounted(() => {
  initThree();
});

onBeforeUnmount(() => {
  // 清理Three.js资源
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
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

<style scoped>
.three-container {
  width: 100%;
  height: 100%;
}
</style>
