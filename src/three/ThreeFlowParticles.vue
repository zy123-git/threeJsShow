<template>
  <div class="three-container">
    <canvas class="canvas_12"></canvas>
  </div>
</template>
  
<script setup>
  import { onBeforeUnmount } from 'vue';

  import * as THREE from 'three';
  import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
  import vertexShader from '@/shader/flowParticlesShader/vertex.glsl?raw';
  import fragmentShader from '@/shader/flowParticlesShader/fragment.glsl?raw';
  import gpgpuShader from '@/shader/flowParticlesShader/gpgpuWithIncludes';
  import { GLTFLoader } from 'three/examples/jsm/Addons.js';
  import { GPUComputationRenderer } from 'three/examples/jsm/Addons.js';
  import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';
  import { useGui } from './shared/gui';
  import { useThreeScene } from './shared/useThreeScene';

  let scene = null;
  let camera = null;
  let renderer = null;
  let renderFrame = null;

  // 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
  const assetToken = beginAssetLoading();

  /**
   * 调试
   */
  // 初始化dat.GUI（useGui 会在组件卸载时自动销毁）
  const gui = useGui(() => new GUI());

  const initThree = async (ctx) => {
    ({ scene, camera, renderer } = ctx);
    const { elementSize } = ctx;

    /**
     * 场景环境设置
     */
    scene.background = new THREE.Color(0x222222);

    const gltfLoader = new GLTFLoader()
    const gltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        'static/mv_spartan/spartan.gltf',
        (loadedGltf) => {
          endAssetLoading(assetToken)
          resolve(loadedGltf)
        },
        (xhr) => {
          reportAssetProgress(assetToken, xhr.loaded, xhr.total)
        },
        (error) => {
          endAssetLoading(assetToken)
          reject(error)
        }
      )
    })

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
            uResolution: new THREE.Uniform(new THREE.Vector2(elementSize.value.width,elementSize.value.height)),
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

    /**
     * 帧更新(动画)
     */
    renderFrame = ({ elapsed, delta }) => {
      //gpgpu更新
      gpgpu.particlesVariable.material.uniforms.uTime.value = elapsed
      gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = delta
      gpgpu.computation.compute()
      particles.material.uniforms.uParticlesTexture.value = gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture
      
      // 渲染
      renderer.render(scene, camera);
    };
  };

  const three = useThreeScene({
    canvas: '.canvas_12',
    camera: { fov: 75, near: 0.1, far: 1000, position: [0, 0, 15] },
    controls: {},
    renderer: { clearColor: 0x000000 },
    onInit: (ctx) => initThree(ctx),
    onFrame: (_ctx, frame) => renderFrame?.(frame),
  });

  onBeforeUnmount(() => {
    // 组合式统一释放场景、控制器与渲染器
    three.dispose();
  });
</script>
  