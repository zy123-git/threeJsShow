<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_7"></canvas>
  </div>
</template>
  
<script setup>
  import { onBeforeUnmount, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import * as THREE from 'three';
  import * as dat from 'dat.gui';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { ModelClickHandler } from '@/utils/threeModelClickHandler';
  import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';
  import { useGui } from './shared/gui';
  import { useThreeScene } from './shared/useThreeScene';
  import { addBasicLights } from './shared/lights';

  const modelClickHandler = new ModelClickHandler();
  const router = useRouter();
  const canvasRef = ref(null);

  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let classroomModel = null;
  let loader = null;
  let renderFrame = null;

  // 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
  const classroomAssetToken = beginAssetLoading();
  const deskAssetToken = beginAssetLoading();

  /**
   * 调试
   */
  // 初始化 dat.GUI
  const gui = useGui(() => new dat.GUI());

  //通过添加到对象的方式可以不用定义，适合一个对象中各个属性的添加，但变量名尽量简短
  const parameters = {};
  parameters.rotationSpeed = 0.0005;

  const initThree = (ctx) => {
    ({ scene, camera, renderer, controls } = ctx);

    /**
     * 场景环境设置
     */
    scene.background = new THREE.Color(0x0a0a1a);

    /**
     * 相机
     */
    scene.add(camera);

    /**
     * 光照
     */
    addBasicLights(scene);

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
        // 加载第一个模型（教室）
        await new Promise((resolve, reject) => {
          loader.load(
            'static/classroom/classroomMiniColor.gltf',
            (gltf) => {
              endAssetLoading(classroomAssetToken);
              classroomModel = gltf.scene;
              console.log(classroomModel);
              // 调整模型大小和位置
              classroomModel.position.set(0, 0, 0);
              classroomModel.rotation.y = Math.PI / 2; // 根据需要调整旋转

              // 计算并输出模型尺寸
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
              reportAssetProgress(classroomAssetToken, xhr.loaded, xhr.total);
            },
            (error) => {
              endAssetLoading(classroomAssetToken);
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
              endAssetLoading(deskAssetToken);
              const mesh = gltf.scene.children.find(child => child.isMesh);
              const geometry = mesh.geometry;

              const instanceCount = 10; // 实例数量
              const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);

              classroomZLenght -= 1;

              // 为每个实例设置不同的位置和旋转
              const matrix = new THREE.Matrix4();
              for (let i = 0; i < instanceCount; i++) {
                // 计算位置
                const x = 1.5 * Math.floor(i / zCount);
                const y = 0.25;
                const z = 3 - classroomZLenght / zCount * (0.5 + i % zCount);

                // 更新矩阵
                matrix.compose(
                  new THREE.Vector3(x, y, z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),
                  new THREE.Vector3(1, 1, 1)
                );

                // 应用到实例
                instancedMesh.setMatrixAt(i, matrix);
              }
              instancedMesh.instanceMatrix.needsUpdate = true;

              // 添加到场景
              scene.add(instancedMesh);
              resolve(true);
            },
            (xhr) => {
              reportAssetProgress(deskAssetToken, xhr.loaded, xhr.total);
            },
            (error) => {
              endAssetLoading(deskAssetToken);
              console.error('An error happened', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        console.error('模型加载失败:', error);
      }
    };

    // 开始顺序加载模型
    loadModelsSequentially();

    /**
     * 帧更新(动画)
     */
    renderFrame = () => {
      // 更新控制器
      controls.update();

      // 渲染
      renderer.render(scene, camera);
    };
  };

  const three = useThreeScene({
    canvas: canvasRef,
    camera: { fov: 75, near: 0.1, far: 1000, position: [0, 2, 5] },
    controls: { enableDamping: true },
    renderer: { pixelRatio: Math.min(window.devicePixelRatio, 2) },
    onInit: (ctx) => initThree(ctx),
    onFrame: () => renderFrame?.(),
  });

  onBeforeUnmount(() => {
    // 清理点击处理器资源
    modelClickHandler.dispose();

    // 组合式统一释放场景、控制器与渲染器
    three.dispose();

    // 清理加载器
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
  