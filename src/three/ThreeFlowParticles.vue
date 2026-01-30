<template>
  <div class="three-container">
    <canvas class="canvas_12"></canvas>
  </div>
</template>
  
<script setup>
  import { onMounted, onBeforeUnmount } from 'vue';
  import { useCanvasSize } from '../utils/ThreeCanvasSize';

  import * as THREE from 'three';
  import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
  import vertexShader from '@/shader/flowParticlesShader/vertex.glsl?raw';
  import fragmentShader from '@/shader/flowParticlesShader/fragment.glsl?raw';
  import gpgpuShader from '@/shader/flowParticlesShader/gpgpuWithIncludes';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { GLTFLoader } from 'three/examples/jsm/Addons.js';
  import { GPUComputationRenderer } from 'three/examples/jsm/Addons.js';

  
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
  gui = new GUI();

  
  const initThree = async () => {
    // 使用画布尺寸组合函数
    const { sizes, updateSize } = useCanvasSize('.three-container');
    
    // 设置容器位置和尺寸
    updateSize();
  
    /**
     * 场景环境设置
     */
    //画布
    canvas = document.querySelector('.canvas_12')
    // 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    
    // 创建相机
    camera = new THREE.PerspectiveCamera(75, sizes.value.width / sizes.value.height, 0.1, 1000);
    camera.position.z = 15; // 调整相机位置以适应50*50小间距粒子矩阵

    controls = new OrbitControls(camera,canvas)

    /**
     * 相机组
     */
    
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(sizes.value.width, sizes.value.height);
    renderer.setClearColor(0x000000); // 设置背景颜色为黑色

    const gltfLoader = new GLTFLoader()
    const gltf = await gltfLoader.loadAsync('static/mv_spartan/spartan.gltf')

    let baseGeometry = {}
    baseGeometry.geometry = gltf.scene.children[0].geometry
    baseGeometry.count = baseGeometry.geometry.attributes.position.count

    let gpgpu = {}
    gpgpu.size = Math.floor(Math.sqrt(baseGeometry.count))+1
    gpgpu.computation = new GPUComputationRenderer(gpgpu.size,gpgpu.size,renderer)

    //FBO初始纹理
    const baseParticlesTexture = gpgpu.computation.createTexture()

    for(let i = 0; i < baseGeometry.count; i++){
      const i3 = i * 3;
      const i4 = i * 4;

      baseParticlesTexture.image.data[i4 + 0] = baseGeometry.geometry.attributes.position.array[i3 + 0]
      baseParticlesTexture.image.data[i4 + 1] = baseGeometry.geometry.attributes.position.array[i3 + 1]
      baseParticlesTexture.image.data[i4 + 2] = baseGeometry.geometry.attributes.position.array[i3 + 2]
      baseParticlesTexture.image.data[i4 + 3] = Math.random()
    }

    
    gpgpu.particlesVariable = gpgpu.computation.addVariable('uParticles', gpgpuShader, baseParticlesTexture)
    gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [gpgpu.particlesVariable])

    gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0)
    gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
    gpgpu.particlesVariable.material.uniforms.uFlowFeildInfluence = new THREE.Uniform(0.5)
    gpgpu.particlesVariable.material.uniforms.uFlowStrength = new THREE.Uniform(1.5)
    //传递初始位置纹理
    gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(baseParticlesTexture)

    gpgpu.computation.init()

    //测试
    gpgpu.debug = new THREE.Mesh(
      new THREE.PlaneGeometry(3,3),
      new THREE.MeshBasicMaterial({
        map: gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture
      })
    )
    gpgpu.debug.position.x = 3
    gpgpu.debug.visible = false
    scene.add(gpgpu.debug)


    let particles = {}

    particles.particleUvArray = new Float32Array(baseGeometry.count * 2)
    for(let y = 0; y < gpgpu.size; y++){
      for(let x = 0; x < gpgpu.size; x++){
        const i = (y * gpgpu.size) + x
        const i2 = i * 2

        const uvX = (x + 0.5) / gpgpu.size
        const uvY = (y + 0.5) / gpgpu.size

        particles.particleUvArray[i2] = uvX
        particles.particleUvArray[i2+1] = uvY
      }
    }

    const buffer = baseGeometry.geometry.attributes.color_1.array
    let realBuffer = new Float32Array(baseGeometry.geometry.attributes.color_1.count * 4)
    for(let i = 0; i < baseGeometry.geometry.attributes.color_1.count * 4; i++){
      realBuffer[i] = buffer[i] / 65535
    }

    particles.particleSize = new Float32Array(baseGeometry.count)
    for(let i = 0; i < baseGeometry.count; i++){
      particles.particleSize[i] = Math.random()
    }

    particles.geometry = new THREE.BufferGeometry()
    particles.geometry.setDrawRange(0,baseGeometry.count)
    particles.geometry.setAttribute('aParticleUv', new THREE.BufferAttribute(particles.particleUvArray, 2))
    particles.geometry.setAttribute('aColor', new THREE.BufferAttribute(realBuffer,4))
    particles.geometry.setAttribute('aParticleSize', new THREE.BufferAttribute(particles.particleSize, 1))

    particles.material = new THREE.ShaderMaterial({
        vertexShader:vertexShader,
        fragmentShader:fragmentShader,
        uniforms:{
            uSize: new THREE.Uniform(0.1),
            uResolution: new THREE.Uniform(new THREE.Vector2(sizes.value.width,sizes.value.height)),
            uParticlesTexture: new THREE.Uniform()
        }
    })

    particles.mParticles = new THREE.Points(particles.geometry, particles.material)

    scene.add(particles.mParticles)

    gui
      .add(particles.material.uniforms.uSize, 'value')
      .min(0.01)
      .max(0.5)
      .step(0.01)
      .name('粒子大小')
    gui
      .add(gpgpu.particlesVariable.material.uniforms.uFlowFeildInfluence, 'value')
      .min(0)
      .max(1)
      .name('影响范围')
    gui
      .add(gpgpu.particlesVariable.material.uniforms.uFlowStrength, 'value')
      .min(0)
      .max(5)
      .step(0.1)
      .name('流动强度')
    
    // 处理窗口大小变化
    const handleResize = () => {
      updateSize();
      
        // 更新canvas元素尺寸
      if (canvas) {
        canvas.style.width = `${sizes.value.width}px`;
        canvas.style.height = `${sizes.value.height}px`;
      }
      
      // 更新相机和渲染器
      camera.aspect = sizes.value.width / sizes.value.height;
      camera.updateProjectionMatrix();

      renderer.setSize(sizes.value.width, sizes.value.height)
      
      particles.material.uniforms.uResolution.value.set(sizes.value.width,sizes.value.height)
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
    let previousTime = 0
    const tick = () => {
      const elapsedTime = clock.getElapsedTime()
      const deltaTime = elapsedTime - previousTime
      previousTime = elapsedTime

      //gpgpu更新
      gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime
      gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime
      gpgpu.computation.compute()
      particles.material.uniforms.uParticlesTexture.value = gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture
      
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
  