<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_4"></canvas>
  </div>
</template>
  
<script setup>
  import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useCanvasSize } from '../utils/ThreeCanvasSize';
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

  // 在ThreeSea.vue中添加
  // 创建噪声纹理
function createNoiseTexture(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = (y * size + x) * 4;
            const noise = Math.random();
            imageData.data[index] = noise * 255;     // R
            imageData.data[index + 1] = noise * 255; // G
            imageData.data[index + 2] = noise * 255; // B
            imageData.data[index + 3] = 255;         // A
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = false; // 禁用mipmap生成
    texture.minFilter = THREE.LinearFilter; // 使用线性过滤
    return texture;
}

  gui = new dat.GUI();
  
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
     camera.lookAt(new THREE.Vector3(0, 0, 0));
     camera.position.y = -2.5;
     camera.position.z = 1.5; // 设置相机位置
     scene.add(camera);
     
    //相机控制
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;


    /**
     * 物体
     */
    //纹理
      // 在材质中使用噪声纹理
    const noiseTexture = createNoiseTexture(256);

    //材质
    const material = new THREE.RawShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCeilingColor: { value: new THREE.Color(parameters.ceilingColor) },
        uFloorColor: { value: new THREE.Color(parameters.floorColor) },
        uWaveMainFrequency: { value: 1.0 },
        uAltitude: { value: 0.4 },
        uNoiseAmplitude: { value: 0.05 },
        uIterationCount: { value: 0.5 },
        uNoiseTexture: { value: noiseTexture },
      },
    });

  
    //几何体
    const geometry = new THREE.PlaneGeometry(2, 2, 256, 256)

    const plane = new THREE.Mesh(geometry, material);
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
  .webgl_4 {
    display: block;
    width: 100%;
    height: 100%;
  }
  </style>
  
  