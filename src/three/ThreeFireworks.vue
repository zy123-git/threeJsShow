<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_6"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { useElementSize } from '../utils/useElementSize';
import * as THREE from 'three';
import gsap from 'gsap';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vertexShader from '@/shader/fireworkShander/vertex.glsl?raw';
import fragmentShader from '@/shader/fireworkShander/fragment.glsl?raw';
import { Sky } from 'three/addons/objects/Sky.js';

// 全局变量声明，便于在组件卸载时进行清�?
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let canvas = null;
let gui = null;
let animationId = null;
let sky = null;
let resizeHandler = null;

//加载烟花图案
const textureLoader = new THREE.TextureLoader();
const textures = []
textures.push(textureLoader.load('/static/particle_icon/icon_01.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_02.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_03.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_04.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_05.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_06.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_07.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_08.png'));
textures.push(textureLoader.load('/static/particle_icon/icon_09.png'));

const createFireworks=(
    particleCount=500,
    position=new THREE.Vector3(0,0,0),
    texture=textures.icon_1,
    radius=1,
  )=>{
    // scene为空时不执行（组件已卸载）
    if (!scene) return;
    const particlePosition = new Float32Array(particleCount * 3);
    const partcleSize = new Float32Array(particleCount);
    const timeMutiplier = new Float32Array(particleCount);
    const colorArray = new Float32Array(particleCount * 3);

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const increment = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2; // y�?�?1
      const orRadius = Math.sqrt(1 - y * y); // 半径在y处的�?
      
      const theta = increment * i; // 黄金角递增
      
      const x = Math.cos(theta) * orRadius;
      const z = Math.sin(theta) * orRadius;

      particlePosition[i * 3    ] = x * radius * 0.8 + (Math.random() - 0.5) * radius * 0.2 + position.x;
      particlePosition[i * 3 + 1] = y * radius * 0.8 + (Math.random() - 0.5) * radius * 0.2 + position.y;
      particlePosition[i * 3 + 2] = z * radius * 0.8 + (Math.random() - 0.5) * radius * 0.2 + position.z;

      partcleSize[i] = Math.random() * 25 + 5;

      timeMutiplier[i] = 1.0 + Math.random();

      const color = new THREE.Color();
      color.setHSL(Math.random(), 1, 0.7);
      colorArray[i * 3    ] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTexture: new THREE.Uniform(texture),
          uProgress: new THREE.Uniform(0),
        },
        blending: THREE.AdditiveBlending,
        depthWrite: false,

    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(particlePosition, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(partcleSize, 1));
    geometry.setAttribute('aTimeMutiplier', new THREE.BufferAttribute(timeMutiplier, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colorArray, 3));
    

    const fireworks = new THREE.Points(geometry, material);
    scene.add(fireworks);

    const destroy = ()=>{
      scene.remove(fireworks);
      geometry.dispose();
      material.dispose();
    }

    gsap.to(material.uniforms.uProgress, {
      value: 1,
      duration: 5,
      ease: 'linear',
      onComplete: destroy,
    })
};

const createRandomFireworks=()=>{
  // scene为空时不执行（组件已卸载）
  if (!scene) return;
  
  const particleCount = Math.floor(Math.random() * 1000 + 400);
  const position = new THREE.Vector3(
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 0.5,
  );
  const texture = textures[Math.floor(Math.random() * textures.length)];
  const radius = Math.random() + 1.5;
  const color = new THREE.Color();
  createFireworks(particleCount, position, texture, radius, color);
}

const init=()=>{
    // 使用画布尺寸组合函数
    const { elementSize, updateElementSize, bindRenderer } = useElementSize('.three-container');
    
    // 设置容器位置和尺�?
    updateElementSize();

    scene = new THREE.Scene();

    canvas = document.querySelector('.webgl_6');

    camera = new THREE.PerspectiveCamera(75, elementSize.value.width / elementSize.value.height, 0.1, 1000);
    camera.position.z = 3;

    controls = new OrbitControls(camera, canvas);
    //使相机的旋转和缩放操作更加流畅自然�?
    controls.enableDamping = true;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });
    renderer.setSize(elementSize.value.width, elementSize.value.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // 绑定响应式尺寸更�?
    bindRenderer(renderer, camera);

    createFireworks();

    // 点击事件处理函数
    const handleClick = () => {
      createRandomFireworks();
    };
    window.addEventListener('click', handleClick);
    
    // 在组件卸载时移除点击事件
    onBeforeUnmount(() => {
      window.removeEventListener('click', handleClick);
    });

    //天空部分
    // Add Sky
    sky = new Sky();
    sky.scale.setScalar( 450000 );
    scene.add( sky );

    const sun = new THREE.Vector3();

    /// GUI

    const effectController = {
      turbidity: 10,
      rayleigh: 3,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.95,
      elevation: -32.2,
      azimuth: 180,
      exposure: renderer.toneMappingExposure
    };

    function guiChanged() {

      const uniforms = sky.material.uniforms;
      uniforms[ 'turbidity' ].value = effectController.turbidity;
      uniforms[ 'rayleigh' ].value = effectController.rayleigh;
      uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
      uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

      const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
      const theta = THREE.MathUtils.degToRad( effectController.azimuth );

      sun.setFromSphericalCoords( 1, phi, theta );

      uniforms[ 'sunPosition' ].value.copy( sun );

      renderer.toneMappingExposure = effectController.exposure;
      renderer.render( scene, camera );

    }

    gui = new GUI();

    gui.add( effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'elevation', 0, 90, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'azimuth', - 180, 180, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'exposure', 0, 1, 0.0001 ).onChange( guiChanged );

    guiChanged();


    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // 渲染场景
      renderer.render(scene, camera);
      // 递归调用 tick 函数
      animationId = requestAnimationFrame(tick);
    };
    tick();
};

// 存储定时器ID的变�?
let fireworkInterval = null;

// 自动播放烟花的函�?
const startAutoFireworks = () => {
  // scene为空时不执行（组件已卸载）
  if (!scene) return;
  
  // 定义烟花播放规律
  let interval = 1000; // 初始间隔1�?
  const minInterval = 100;
  const maxInterval = 1500;
  
  // 避免重复创建定时�?
  if (fireworkInterval !== null) {
    clearTimeout(fireworkInterval);
  }
  
  // 创建新的定时�?
  fireworkInterval = setTimeout(() => {
    // 随机播放1-3个烟�?
    const fireworkCount = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < fireworkCount; i++) {
      createRandomFireworks();
    }

    interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
      
    // 清除当前定时器并设置新的定时器，避免递归调用
    clearTimeout(fireworkInterval);
    startAutoFireworksWithDelay(interval);
  }, interval);
};

// 使用setTimeout替代递归调用，避免调用栈累积
const startAutoFireworksWithDelay = (delay) => {
  // scene为空时不执行（组件已卸载）
  if (!scene) return;
  
  fireworkInterval = setTimeout(() => {
    startAutoFireworks();    
  }, delay);
};

// 在组件卸载时进行完整的资源清�?
onBeforeUnmount(() => {
  // 1. 清除所有定时器和setTimeout
  if (fireworkInterval !== null) {
    clearTimeout(fireworkInterval);
    clearInterval(fireworkInterval);
    fireworkInterval = null;
  }
  
  // 2. 取消动画帧请�?
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // 3. 移除事件监听�?
  if (resizeHandler !== null) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  
  // 4. 销毁GUI
  if (gui !== null) {
    gui.destroy();
    gui = null;
  }
  
  // 5. 清理Three.js资源 - 更安全的方式
  try {
    // 不要使用traverse，而是直接清空场景中的对象引用
    if (scene && scene.children && Array.isArray(scene.children)) {
      // 直接清空子对象数组，避免在遍历时修改集合
      const children = [...scene.children];
      children.forEach((child) => {
        try {
          // 单独清理几何体和材质
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
          // 移除子对�?
          if (scene && scene.remove) scene.remove(child);
        } catch (err) {
          // 忽略单个对象清理的错�?
          console.warn('Error disposing child object:', err);
        }
      });
    }
    // 直接设置scene为null
    scene = null;
  } catch (err) {
    console.warn('Error during scene cleanup:', err);
    // 确保scene被重置为null
    scene = null;
  }
  
  // 6. 清理相机控制
  try {
    if (controls && typeof controls.dispose === 'function') {
      controls.dispose();
    }
    controls = null;
  } catch (err) {
    console.warn('Error disposing controls:', err);
    controls = null;
  }
  
  // 7. 清理纹理
  try {
    if (Array.isArray(textures)) {
      textures.forEach(texture => {
        try {
          if (texture && typeof texture.dispose === 'function') {
            texture.dispose();
          }
        } catch (err) {
          console.warn('Error disposing texture:', err);
        }
      });
      // 清空数组引用
      textures = [];
    }
  } catch (err) {
    console.warn('Error during textures cleanup:', err);
  }
  
  // 8. 释放WebGL渲染器和上下�?
  try {
    if (renderer && typeof renderer.dispose === 'function') {
      // 停止渲染�?
      renderer.dispose();
      
      // 尝试释放WebGL上下�?
      try {
        if (renderer.getContext) {
          const gl = renderer.getContext();
          if (gl && gl.getExtension) {
            const extension = gl.getExtension('WEBGL_lose_context');
            if (extension && typeof extension.loseContext === 'function') {
              extension.loseContext();
            }
          }
        }
      } catch (err) {
        console.warn('Error releasing WebGL context:', err);
      }
    }
    // 注意：不再手动从DOM中移除canvas元素，让Vue自动处理DOM清理
    renderer = null;
  } catch (err) {
    console.warn('Error disposing renderer:', err);
    renderer = null;
  }
  
  // 9. 重置其他引用
  camera = null;
  canvas = null;
  sky = null;
  
  // 10. 清除GSAP动画
  try {
    if (typeof gsap !== 'undefined' && gsap.killTweensOf) {
      gsap.killTweensOf('*');
    }
  } catch (err) {
    console.warn('Error clearing GSAP animations:', err);
  }
});

onMounted(() => {
  init();
  // 延迟1秒后开始自动播放烟�?
  setTimeout(() => {
    startAutoFireworks();
  }, 1000);
});

</script>