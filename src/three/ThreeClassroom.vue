<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_7"></canvas>
  </div>
</template>
  
<script setup>
  import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useElementSize } from '../utils/useElementSize';
  import { useRouter } from 'vue-router';
  import * as THREE from 'three';
  import * as dat from 'dat.gui';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { ModelClickHandler } from '@/utils/threeModelClickHandler';
  const modelClickHandler = new ModelClickHandler();
  const router = useRouter();

  let canvas = null;
  let gui = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let classroomModel = null;
  let loader = null;
  
  /**
   * 调试
   */
  // 初始�?dat.GUI
  gui = new dat.GUI();
  
  //通过添加到对象的方式可以不用定义，适合一个对象中各个属性的添加，但变量名尽量简�?
  const parameters = {};
  parameters.rotationSpeed = 0.0005;
  
  const initThree = () => {
    // 使用画布尺寸组合函数
    const { elementSize, updateElementSize, bindRenderer } = useElementSize('.three-container');
    
    // 设置容器位置和尺寸
    updateElementSize();
  
    /**
     * 场景环境设置
     */
    //画布
    canvas=document.querySelector('.webgl_7');
    // 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    
    /**
     * 相机
     */
     camera = new THREE.PerspectiveCamera(75, elementSize.value.width / elementSize.value.height, 0.1, 1000);
     camera.position.set(0, 2, 5); // 设置相机位置
     scene.add(camera);
     
    //相机控制
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // 渲染�?
    renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(elementSize.value.width, elementSize.value.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /**
     * 光照
     */
    // 环境�?
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // 平行�?
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const material = new THREE.MeshStandardMaterial({
      color: 0xe67e22,  // 温暖橙色
      metalness: 0.1,
      roughness: 0.7
    });

    
    /**
     * 加载教室模型
     */
    let classroomXLenght = 1;
    let classroomZLenght = 1;
    modelClickHandler.init(scene, camera, renderer.domElement);
    loader = new GLTFLoader();
    
    // 加载模型 - 顺序加载实现
    const loadModelsSequentially = async () => {
      try {
        // 加载第一个模型（教室�?
        await new Promise((resolve, reject) => {
          loader.load(
            'static/classroom/classroomMiniColor.gltf',
            (gltf) => {
              classroomModel = gltf.scene;
              console.log(classroomModel);
              // 调整模型大小和位�?
              classroomModel.position.set(0, 0, 0);
              classroomModel.rotation.y = Math.PI / 2; // 根据需要调整旋�?

              // 计算并输出模型尺�?
              const box = new THREE.Box3().setFromObject(classroomModel);
              const size = new THREE.Vector3();
              box.getSize(size);

              classroomXLenght = size.x;
              classroomZLenght = size.z;

              /**
              * 射线选择
              */
              modelClickHandler.addClickListener(
                classroomModel,
                'blackboard',
                (element, event, intersection) => {
                  // 使用Vue Router跳转到/html-forest界面
                  router.push('/html-forest');
                }
              );

              scene.add(classroomModel);
              resolve(true);
            },
            (xhr) => {
              // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
              console.error('An error happened', error);
              reject(error);
            }
          );
        });

        // 第一个模型加载完成后，加载第二个模型（桌椅）
        const zCount = 3;

        await new Promise((resolve, reject) => {
          loader.load(
            'static/deskAndChair/deskAndChair.glb',
            (gltf) => {
              const mesh = gltf.scene.children.find(child => child.isMesh);
              const geometry = mesh.geometry;

              const instanceCount = 10; // 实例数量
              const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);

              classroomZLenght-=1;


              
              // 为每个实例设置不同的位置和旋�?
              const matrix = new THREE.Matrix4();
              for (let i = 0; i < instanceCount; i++) {
                // 计算位置
                const x = 1.5*Math.floor(i/zCount);
                const y = 0.25;
                const z = 3 - classroomZLenght/zCount*(0.5 + i%zCount);

                // 更新矩阵
                matrix.compose(
                  new THREE.Vector3(x, y, z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),
                  new THREE.Vector3(1, 1, 1)
                );
                
                // 应用到实�?
                instancedMesh.setMatrixAt(i, matrix);
              }
              instancedMesh.instanceMatrix.needsUpdate = true;

              // 添加到场�?
              scene.add(instancedMesh);
              resolve(true);
            },
            undefined,
            (error) => {
              console.error('An error happened', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        console.error('模型加载失败:', error);
      }
    };

    // 开始顺序加载模�?
    loadModelsSequentially();
    
    // 绑定响应式尺寸更新
    bindRenderer(renderer, camera);

  
    /**
     * 帧更�?动画)
     */
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();
      
      
      // 更新控制�?
      controls.update();
      
      // 渲染
      renderer.render(scene, camera);
    
      // 继续调用 tick 函数
      requestAnimationFrame(tick);
    };
  
    // 启动动画循环
    tick();
  };
  
  onMounted(() => {
    initThree();
  });
  
  onBeforeUnmount(() => {
    // 清理点击处理器资�?
    modelClickHandler.dispose();
    
    if (gui) {
      gui.destroy();
    }
  
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
    
    // 清理加载�?
    if (loader) {
      if (loader.manager && typeof loader.manager.dispose === 'function') {
        loader.manager.dispose();
      }
    }
  });
  </script>
  
  <style scoped>
  /* Canvas样式 */
  .webgl_7 {
    display: block;
    width: 100%;
    height: 100%;
  }
  </style>
  