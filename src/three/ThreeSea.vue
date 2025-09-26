<template>
  <canvas ref="canvasRef" class="webgl_4"></canvas>
</template>
  
<script setup>
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import * as THREE from 'three';
  import * as dat from 'dat.gui';
  import vertexShader from '@/shader/seaShader/vertex.glsl?raw';
  import fragmentShader from '@/shader/seaShader/fragment.glsl?raw';
  import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

  
  const canvasRef = ref(null);
  let canvas = null;
  let gui = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  
  //通过添加到对象的方式可以不用定义，适合一个对象中各个属性的添加，但变量名尽量简便
  const parameters = {};
  parameters.ceilingColor = '#9bd8ff';
  parameters.floorColor = '#186691';

  gui = new dat.GUI();
  
  const initThree = () => {
    //窗口大小信息
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  
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
     camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
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
        uCeilingColor: { value: new THREE.Color(parameters.ceilingColor) },
        uFloorColor: { value: new THREE.Color(parameters.floorColor) },
      },
    });

  
    //几何体
    const geometry = new THREE.PlaneGeometry(2, 2, 512, 512)

    const plane = new THREE.Mesh(geometry, material);
    console.log(plane);
    scene.add(plane);

    /**
     * 调试
     */
    // 初始化 dat.GUI
    gui.addColor(parameters, 'ceilingColor').name('顶部颜色').onChange((value) => {        
        material.uniforms.uCeilingColor.value.set(parameters.ceilingColor) ;
    });
    gui.addColor(parameters, 'floorColor').name('底部颜色').onChange((value) => {
        material.uniforms.uFloorColor.value.set(parameters.floorColor) ;
    });
  
    /**
     * 光线
     */
    
    /**
     * 相机组
     */
    
    // 渲染器 - 使用已声明的全局renderer变量
    renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000); // 设置背景颜色为黑色
  
  
  
    /**
     * 帧更新(动画)
     */
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();
      //物体动画
      material.uniforms.uTime.value = elapsedTime;
      
      
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
  
  