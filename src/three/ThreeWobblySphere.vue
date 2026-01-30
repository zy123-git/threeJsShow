<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="canvas_9"></canvas>
  </div>
</template>
  
<script setup>
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import { useCanvasSize } from '../utils/ThreeCanvasSize';

  import * as THREE from 'three';
  import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
  import vertexShader from '@/shader/bookShader/vertex.glsl?raw';
  import fragmentShader from '@/shader/bookShader/fragment.glsl?raw';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

  let canvas = null;
  let gui = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let sizes = null;
  let updateSize = null;
  let cubeTextureLoader = null
  let environmentMap = null
  
  /**
   * 调试
   */
  // 初始化 dat.GUI
  gui = new GUI()
  
  
  const initThree = () => {
    // 使用画布尺寸组合函数
    const sizeResult = useCanvasSize('.three-container');
    sizes = sizeResult.sizes;
    updateSize = sizeResult.updateSize;
    
    // 设置容器位置和尺寸
    updateSize();
  
    /**
     * 场景环境设置
     */
    //画布
    canvas = document.querySelector('.canvas_9')
    // 场景
    scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x222222);
    
    /**
     * 相机
     */
    camera = new THREE.PerspectiveCamera(75, sizes.value.width / sizes.value.height, 0.1, 100);
    camera.position.set(0, 0, 5); // 从 z 轴正方向看向原点
    scene.add(camera);
     
    //相机控制
    controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    
    // 渲染器
    renderer = new THREE.WebGLRenderer({ canvas })
    renderer.setSize(sizes.value.width, sizes.value.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // renderer.setClearColor(0x000000); // 设置背景颜色为黑色

    //环境贴图
    cubeTextureLoader = new THREE.CubeTextureLoader()
    environmentMap = cubeTextureLoader.load([
      'static/environment_map/0/px.png',
      'static/environment_map/0/nx.png',
      'static/environment_map/0/py.png',
      'static/environment_map/0/ny.png',
      'static/environment_map/0/pz.png',
      'static/environment_map/0/nz.png'
    ])

    scene.environment = environmentMap
    scene.background = environmentMap

    const geometry = new THREE.SphereGeometry(1)

    const material = new THREE.MeshBasicMaterial({
      metalness: 0.7,
      roughness: 0.2,
    })

    const wobblySphere = new THREE.Mesh(geometry,material)
    scene.add(wobblySphere)

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResize);
    });
  
    /**
     * 帧更新(动画)
     */
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // 渲染
      renderer.render(scene, camera);
  
      requestAnimationFrame(tick);
    };
  
    // 启动动画循环
    tick();
  };

      // 处理窗口大小变化
    const handleResize = () => {
      updateSize();
      
      camera.updateProjectionMatrix();
      
      // 更新渲染器
      renderer.setSize(sizes.value.width, sizes.value.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  /* Canvas样式 */
  .webgl_3 {
    display: block;
    width: 100%;
    height: 100%;
  }
  </style>
  