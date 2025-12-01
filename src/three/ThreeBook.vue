<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_3"></canvas>
  </div>
</template>
  
<script setup>
  import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useCanvasSize } from '../utils/ThreeCanvasSize';

  import * as THREE from 'three';
  import * as dat from 'dat.gui';
  import vertexShader from '@/shader/bookShader/vertex.glsl?raw';
  import fragmentShader from '@/shader/bookShader/fragment.glsl?raw';
  import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

  
  const canvasRef = ref(null);
  let canvas = null;
  let gui = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  
  /**
   * 调试
   */
  // 初始化 dat.GUI
  gui = new dat.GUI();
  
  //通过添加到对象的方式可以不用定义，适合一个对象中各个属性的添加，但变量名尽量简便
  const parameters = {};
  
  const initThree = () => {
    // 使用画布尺寸组合函数
    const { size, updateSize } = useCanvasSize('.three-container');
    
    // 设置容器位置和尺寸
    updateSize();
  
    /**
     * 场景环境设置
     */
    //画布
    canvas = canvasRef.value;
    // 场景
    scene = new THREE.Scene();
    
    /**
     * 相机
     */
     camera = new THREE.PerspectiveCamera(75, size.value.width / size.value.height, 0.1, 100);
     camera.position.z = 1.5; // 设置相机位置
     scene.add(camera);
     
    //相机控制
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;


    /**
     * 物体
     */
    //纹理

    //材质
    const material = new THREE.RawShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
      },
    });

  
    //几何体
    const geometry = new THREE.PlaneGeometry(1, 1, 128, 128)

    const plane = new THREE.Mesh(geometry, material);
    
    // 创建一个父对象作为旋转轴
    const rotationParent = new THREE.Object3D();
    scene.add(rotationParent);
    
    // 将平面添加到父对象，并调整位置使得一条边对齐父对象原点
    // 这里我们选择绕X轴正方向的边旋转，所以将平面向左移动0.5单位
    plane.position.x = 0.5;
    rotationParent.add(plane);
  
    /**
     * 光线
     */
    
    /**
     * 相机组
     */
    
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ canvas });
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

  
  
  
    /**
     * 帧更新(动画)
     */
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();
      //物体动画
      // 旋转父对象而不是直接旋转平面，这样就可以绕着边旋转
      rotationParent.rotation.y = elapsedTime;
      
      
      // 渲染
      //这是整个流程的最后一步，在帧更新中渲染即可，
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
  .webgl_3 {
    display: block;
    width: 100%;
    height: 100%;
  }
  </style>
  
  