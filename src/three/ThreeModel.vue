<template>
  <div class="three-container">
    <canvas class="webgl_2"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useCanvasSize } from '../utils/ThreeCanvasSize';
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
  // 使用画布尺寸组合函数
  const { size, updateSize } = useCanvasSize('.three-container');
  
  // 设置容器位置和尺寸
  updateSize();
  /**
   * 场景环境设置
   */
  //画布
  canvas = document.querySelector('canvas.webgl_2');

  // 场景
  scene = new THREE.Scene();

   /**
   * 相机
   */
   camera = new THREE.PerspectiveCamera(75, size.value.width / size.value.height, 0.1, 100);
   camera.position.set(0.0 ,0.2, 0.0);
   scene.add(camera);
   //相机控制
   controls = new OrbitControls(camera, canvas);
   
   controls.enableDamping = true;

  // 相机组



  /**
   * 纹理
   */
  // 加载模型的材质文件
  // threeModel = new GLTFLoader();
  // threeModel.load(
  //   'static/car_book/uploads_files_4638778_lowpoly_novle_(GLB).glb',
  //   (gltf) => {
  //     const model = gltf.scene;
  //     model.position.set(0, 0.01, 0)
      
  //     // 加载纹理
  //     const textureLoader = new THREE.TextureLoader();
      
  //     // 加载各种纹理
  //     const baseColorTexture = textureLoader.load('static/car_book/sideHustle_novel_BaseColor.png');
  //     const normalTexture = textureLoader.load('static/car_book/sideHustle_novel_Normal_GL.png');
  //     const metallicTexture = textureLoader.load('static/car_book/sideHustle_novel_Metallic.png');
  //     const roughnessTexture = textureLoader.load('static/car_book/sideHustle_novel_Roughness.png');
  //     const ambientOcclusionTexture = textureLoader.load('static/carBook/sideHustle_novel_AmbientOcclusion.png');
      
  //     baseColorTexture.flipY = false;
  //     normalTexture.flipY = false;
  //     metallicTexture.flipY = false;
  //     roughnessTexture.flipY = false;
  //     ambientOcclusionTexture.flipY = false;

      
  //     // 遍历模型，为每个网格应用新材质
  //     model.traverse((child) => {
  //       if (child.isMesh) {
  //         // 创建新的材质
  //         const material = new THREE.MeshStandardMaterial({
  //           map: baseColorTexture,
  //           normalMap: normalTexture,
  //           metalnessMap: metallicTexture,
  //           roughnessMap: roughnessTexture,
  //           aoMap: ambientOcclusionTexture,
  //           metalness: 0.2,
  //           roughness: 0.7,
  //           side: THREE.DoubleSide
  //         });
          
  //         // 检查是否有uv2属性，如果没有则创建一个
  //         if (!child.geometry.attributes.uv2) {
  //           child.geometry.setAttribute('uv2', new THREE.BufferAttribute(child.geometry.attributes.uv.array, 2));
  //         }
          
  //         child.material = material;
  //       }
  //     });
      
  //     scene.add(model);
  //   },
  //   // (xhr) => {
  //   //   console.log(xhr);
  //   // },
  //   (error) => {
  //     console.log(error);
  //   }
  // );

  /**
   * 地面
   */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /**
   * 模型
   */
  threeModel = new GLTFLoader();
  threeModel.load(
    'static/ancient_books/ancient_books.gltf',
    (gltf) => {
      const model = gltf.scene;
      
      // 设置模型位置
      model.position.set(0, 0.01, 0);
      
      // 模型已经包含材质信息，我们可以直接使用
      // 遍历模型，可以根据需要进行额外的修改
      model.traverse((child) => {
        if (child.isMesh) {
          // 确保材质可见性和正确设置
          if (child.material) {
            // 可以保留原始材质或根据需要修改
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                material.side = THREE.DoubleSide;
              });
            } else {
              child.material.side = THREE.DoubleSide;
            }
          }
        }
      });

      scene.add(model);
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
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // 点光源
  const pointLight = new THREE.PointLight(0xffffff, 3);
  pointLight.position.set(0, 1, 0);
  scene.add(pointLight);

  // 渲染器
  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(size.value.width, size.value.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000); // 设置背景颜色为黑色
  
  // 处理窗口大小变化
  const handleResize = () => {
    updateSize();
    
    // 更新相机
    camera.aspect = size.value.width / size.value.height;
    camera.updateProjectionMatrix();
    
    // 更新渲染器
    renderer.setSize(size.value.width, size.value.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
  });

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
/* 主容器样式 */
.three-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0; /* 确保在导航栏下方 */
}

/* Canvas样式 */
.webgl_2 {
  display: block;
  width: 100%;
  height: 100%;
}
</style>