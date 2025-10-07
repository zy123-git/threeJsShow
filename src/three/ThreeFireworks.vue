<template>
  <canvas ref="canvasRef" class="webgl_6"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vertexShader from '@/shader/fireworkShander/vertex.glsl?raw';
import fragmentShader from '@/shader/fireworkShander/fragment.glsl?raw';
import { Sky } from 'three/addons/objects/Sky.js';

let scene;

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
    const particlePosition = new Float32Array(particleCount * 3);
    const partcleSize = new Float32Array(particleCount);
    const timeMutiplier = new Float32Array(particleCount);
    const colorArray = new Float32Array(particleCount * 3);

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const increment = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2; // y从1到-1
      const orRadius = Math.sqrt(1 - y * y); // 半径在y处的圆
      
      const theta = increment * i; // 黄金角递增
      
      const x = Math.cos(theta) * orRadius;
      const z = Math.sin(theta) * orRadius;

      particlePosition[i * 3    ] = x * radius + (Math.random() - 0.5) * radius * 0.25 + position.x;
      particlePosition[i * 3 + 1] = y * radius + (Math.random() - 0.5) * radius * 0.25 + position.y;
      particlePosition[i * 3 + 2] = z * radius + (Math.random() - 0.5) * radius * 0.25 + position.z;

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
  const particleCount = Math.floor(Math.random() * 1000 + 400);
  const position = new THREE.Vector3(
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 0.5,
  );
  const texture = textures[Math.floor(Math.random() * textures.length)];
  const radius = Math.random() + 0.5;
  const color = new THREE.Color();
  createFireworks(particleCount, position, texture, radius, color);
}

const init=()=>{
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight, 
    };

    scene = new THREE.Scene();

    const canvas=document.querySelector('.webgl_6');

    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
    camera.position.z = 3;

    const controls = new OrbitControls(camera, canvas);
    //使相机的旋转和缩放操作更加流畅自然。
    controls.enableDamping = true;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });
    renderer.setSize(sizes.width, sizes.height);

    createFireworks();

    addEventListener('click',()=>{
      createRandomFireworks();
    })

    //天空部分
    	// Add Sky
				const sky = new Sky();
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

				const gui = new GUI();

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
      requestAnimationFrame(tick);
    };
    tick();
};

// 存储定时器ID的变量
let fireworkInterval = null;

// 自动播放烟花的函数
const startAutoFireworks = () => {
  // 定义烟花播放规律
  let interval = 1000; // 初始间隔1秒
  const minInterval = 100;
  const maxInterval = 1500;
  
  // 避免重复创建定时器
  if (fireworkInterval !== null) {
    clearInterval(fireworkInterval);
  }
  
  // 创建新的定时器
  fireworkInterval = setTimeout(() => {
    // 随机播放1-3个烟花
    const fireworkCount = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < fireworkCount; i++) {
      createRandomFireworks();
    }

    interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
      
    // 清除当前定时器并设置新的定时器，避免递归调用
    clearInterval(fireworkInterval);
    startAutoFireworksWithDelay(interval);
  }, interval);
};

// 使用setTimeout替代递归调用，避免调用栈累积
const startAutoFireworksWithDelay = (delay) => {
  setTimeout(() => {
    startAutoFireworks();    
  }, delay);
};

// 在组件卸载时清除定时器（只注册一次）
onBeforeUnmount(() => {
  if (fireworkInterval !== null) {
    clearInterval(fireworkInterval);
    fireworkInterval = null;
  }
});

onMounted(() => {
  init();
  // 延迟1秒后开始自动播放烟花
  setTimeout(() => {
    startAutoFireworks();
  }, 1000);
});


</script>