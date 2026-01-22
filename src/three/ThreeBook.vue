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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

  
  const canvasRef = ref(null);
  let canvas = null;
  let gui = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
// 自转圆环
let rotatingRing = null;
// 控制圆环在世界中的平移的父级组（圆环自己保持在组的局部原点，用于“纯自转”）
let ringGroup = null;
  
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
    scene.background = new THREE.Color(0x222222);

    // 坐标轴辅助器（长度为 1，可根据需要调大）
    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);
    
    /**
     * 相机（正交相机）
     */
    const aspect = size.value.width / size.value.height || 1;
    const frustumHeight = 2; // 可视高度（世界坐标单位），根据需要调节“远近感”
    const halfH = frustumHeight / 2;
    const halfW = halfH * aspect;

    camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
    camera.position.set(0, 0, 5); // 从 z 轴正方向看向原点
    camera.lookAt(new THREE.Vector3(0, 0, 0));
     scene.add(camera);
     
    //相机控制
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;


    /**
     * 物体
     */
    //纹理

    //材质
    // const material = new THREE.RawShaderMaterial({
    //   vertexShader: vertexShader,
    //   fragmentShader: fragmentShader,
    //   side: THREE.DoubleSide,
    //   uniforms: {
    //     uTime: { value: 0 },
    //   },
    // });

  
    //几何体
    const cube = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      metalness: 0.5,
      roughness: 0.25,
      emissive: 0x111111,
    });
    const cubeMesh = new THREE.Mesh(cube, cubeMaterial);
    // scene.add(cubeMesh);
    
    // 将平面添加到父对象，并调整位置使得一条边对齐父对象原点
    // 这里我们选择绕X轴正方向的边旋转，所以将平面向左移动0.5单位
    // rotationParent.add(plane);

    // 创建一个自转的圆环
    const ringGeometry = new THREE.TorusGeometry(0.35, 0.001, 32, 64);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0.25,
      emissive: 0x111111,
    });
    rotatingRing = new THREE.Mesh(ringGeometry, ringMaterial);

    // 使用父级组控制圆环在世界中的位置，圆环本身保持在组的局部原点，保证自转中心就是几何中心
    ringGroup = new THREE.Object3D();
    ringGroup.position.set(0, 0, 0); // 放在书页前方一点，避免遮挡太多
    ringGroup.add(rotatingRing);
    scene.add(ringGroup);
  
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
      
      // 更新正交相机的截锥体参数，保持内容不拉伸
      const aspect = size.value.width / size.value.height || 1;
      const frustumHeight = 2;
      const halfH = frustumHeight / 2;
      const halfW = halfH * aspect;

      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
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
      // 书页绕边缘旋转
      cubeMesh.rotation.y = elapsedTime;
      
      // 圆环自转：严格绕自身 Z 轴（使用绝对角度，避免数值误差累积）
      if (rotatingRing) {
        rotatingRing.rotation.set(0, elapsedTime, 0);
      }
      
      // 渲染
      renderer.render(scene, camera);
  
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
  /* Canvas样式 */
  .webgl_3 {
    display: block;
    width: 100%;
    height: 100%;
  }
  </style>
  