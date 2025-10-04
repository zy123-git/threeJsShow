<template>
  <canvas class="webgl_2"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
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
  //窗口大小信息
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
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
   camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
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
    'static/old_book/old_book_(GLTF).gltf',
    (gltf) => {
      const model = gltf.scene;
      model.position.set(0, 0.01, 0)

      const textureLoader = new THREE.TextureLoader();
      const baseColorTexture = textureLoader.load('static/old_book/old_book_Old%20old_book_BaseColor.png');
      const normalTexture = textureLoader.load('static/old_book/old_book_Old%20old_book_Normal_GL.png');
      const metallicTexture = textureLoader.load('static/old_book/old_book_Old%20old_book_Metallic.png');
      const roughnessTexture = textureLoader.load('static/old_book/old_book_Old%20old_book_Roughness.png');
      const ambientOcclusionTexture = textureLoader.load('static/old_book/old_book_Old%20old_book_AmbientOcclusion.png');

      baseColorTexture.flipY = false;
      normalTexture.flipY = false;
      metallicTexture.flipY = false;
      roughnessTexture.flipY = false;
      ambientOcclusionTexture.flipY = false;

      // 遍历模型，为每个网格应用新材质
      model.traverse((child) => {
        if (child.isMesh) {
          // 创建新的材质
          const material = new THREE.MeshStandardMaterial({
            map: baseColorTexture,
            normalMap: normalTexture,
            metalnessMap: metallicTexture,
            roughnessMap: roughnessTexture,
            aoMap: ambientOcclusionTexture,
            metalness: 0.2,
            roughness: 0.7,
            side: THREE.DoubleSide
          });
          
          // 检查是否有uv2属性，如果没有则创建一个
          if (!child.geometry.attributes.uv2) {
            child.geometry.setAttribute('uv2', new THREE.BufferAttribute(child.geometry.attributes.uv.array, 2));
          }
          
          child.material = material;
        }
      });

      scene.add(model);
    },
    (xhr) => {
      console.log(xhr);
    },
    (error) => {
      console.log(error);
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
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000); // 设置背景颜色为黑色

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