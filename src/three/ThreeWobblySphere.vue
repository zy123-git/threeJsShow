<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="canvas_9"></canvas>
  </div>
</template>
  
<script setup>
  import { onBeforeUnmount, ref } from 'vue';

  import * as THREE from 'three';
  import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
  import vertexShader from '@/shader/wobblySphereShader/vertexWithIncludes';
  import fragmentShader from '@/shader/wobblySphereShader/fragment.glsl?raw';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { RGBELoader } from 'three/examples/jsm/Addons.js';
  import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
  import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
  import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';
  import { useGui } from './shared/gui';
  import { useThreeScene } from './shared/useThreeScene';

  const canvasRef = ref(null);
  let scene = null;
  let camera = null;
  let renderer = null;
  let renderFrame = null;

  let environmentMap = null
  let rgbeLoader = null

  // 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
  const assetToken = beginAssetLoading();

  const gui = useGui(() => new GUI());

  const initThree = (ctx) => {
    ({ scene, camera, renderer } = ctx);

    /**
     * 场景环境设置
     */
    scene.add(camera);

    // 渲染器阴影配置
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    //环境贴图
    rgbeLoader = new RGBELoader() 
    rgbeLoader.load('static/environment_map/0/cedar_bridge_sunset_1_4k.hdr',(environmentMap)=>
    {
      endAssetLoading(assetToken);
      environmentMap.mapping = THREE.EquirectangularReflectionMapping

      scene.environment = environmentMap
      scene.background = environmentMap
    },
    (xhr) => {
      reportAssetProgress(assetToken, xhr.loaded, xhr.total);
    },
    (error) => {
      endAssetLoading(assetToken);
      console.error('环境贴图加载失败:', error);
    })
    scene.environmentIntensity = 0.1
    scene.backgroundIntensity = 0.1
    

    //光线
    const directionalLight = new THREE.DirectionalLight('#ffffff', 1)
    
    // 设置光线方向为沿x轴正方向到负方向
    directionalLight.position.set(5, 3, 5);
    
    // 启用阴影投射
    directionalLight.castShadow = true;
    
    // 配置阴影相机参数
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    
    // 设置阴影贴图分辨率
    // directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    
    // 设置阴影贴图类型
    directionalLight.shadow.type = THREE.PCFSoftShadowMap;
    
    scene.add(directionalLight)

    const uniforms = {
    }

    let geometry = new THREE.IcosahedronGeometry(2.5, 50)
    geometry = mergeVertices(geometry)
    geometry.computeTangents()
    console.log(geometry)

    // Debug: print vertex shader snippet to verify includes/preprocessing
    // eslint-disable-next-line no-console

    const material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,

      uniforms: {
        uTime: new THREE.Uniform(),
        uWarpPositionFrequency: new THREE.Uniform(1.0),
        uWarpTimeFrequency: new THREE.Uniform(0.3),
        uWarpStrength: new THREE.Uniform(0.4),
        uPositionFrequency: new THREE.Uniform(0.6),
        uTimeFrequency: new THREE.Uniform(0.3),
        uStrength: new THREE.Uniform(0.3),
        uColorHigh: new THREE.Uniform(new THREE.Color('#ff0000')),
        uColorLow: new THREE.Uniform(new THREE.Color('#0000ff')),
      },

      metalness: 0.0,
      roughness: 0.5,
      color: '#aaaaaa',
      transmission: 0,
      ior: 1.5,
      thickness: 1.5,
      transparent: true,
      wireframe: false

    })

    const wobblySphere = new THREE.Mesh(geometry,material)
    wobblySphere.castShadow = true
    wobblySphere.receiveShadow = true
    scene.add(wobblySphere)

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshPhysicalMaterial({
        color: '#aaaaaa'
      })
    )
    plane.position.set(-3, 0, -3)
    plane.rotation.y = Math.PI/4
    plane.castShadow = true;
    plane.receiveShadow = true
    scene.add(plane)

    gui
      .add(material, 'metalness')
      .min(0)
      .max(1)
      .step(0.001)
      .name('metalness')
      .onChange((value)=>{
        material.metalness = value
      })
    
    gui
      .add(material, 'roughness')
      .min(0)
      .max(1)
      .step(0.001)
      .name('roughness')
      .onChange((value)=>{
        material.roughness = value
      })

    gui
      .add(material, 'transmission')
      .min(0)
      .max(1)
      .step(0.001)
      .name('transmission')
      .onChange((value)=>{
        material.transmission = value
      })

    gui
      .add(material, 'ior')
      .min(0)
      .max(1.5)
      .step(0.001)
      .name('ior')
      .onChange((value)=>{
        material.ior = value
      })
    
    gui
      .add(material.uniforms.uWarpPositionFrequency, 'value')
      .min(0)
      .max(1.0)
      .step(0.001)
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uWarpPositionFrequency.value = value
      })

    gui
      .add(material.uniforms.uWarpTimeFrequency, 'value')
      .min(0)
      .max(1.0)
      .step(0.001)
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uWarpTimeFrequency.value = value
      })

    gui
      .add(material.uniforms.uWarpStrength, 'value')
      .min(0)
      .max(2.0)
      .step(0.01)
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uWarpStrength.value = value
      })

    gui
      .add(material.uniforms.uPositionFrequency, 'value')
      .min(0)
      .max(1.0)
      .step(0.001)
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uPositionFrequency.value = value
      })     

    gui
      .add(material.uniforms.uTimeFrequency, 'value')
      .min(0)
      .max(1.0)
      .step(0.001)
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uTimeFrequency.value = value
      })

    gui
      .add(material.uniforms.uStrength, 'value')
      .min(0)
      .max(2.0)
      .step(0.01)
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uStrength.value = value
      })

    gui
      .addColor(material.uniforms.uColorHigh, 'value')
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uColorHigh.value = value
      })
      
    gui
      .addColor(material.uniforms.uColorLow, 'value')
      .name('warpPositionFrequency')
      .onChange((value)=>{
        material.uniforms.uColorLow.value = value
      }) 

    /**
     * 帧更新(动画)
     */
    renderFrame = (elapsedTime) => {
      material.uniforms.uTime.value = elapsedTime

      // 渲染
      renderer.render(scene, camera);
    };
  };

  const three = useThreeScene({
    canvas: canvasRef,
    camera: { fov: 75, near: 0.1, far: 100, position: [0, 0, 5] },
    controls: { enableDamping: true },
    renderer: { pixelRatio: Math.min(window.devicePixelRatio, 2) },
    onInit: (ctx) => initThree(ctx),
    onFrame: (_ctx, frame) => renderFrame?.(frame.elapsed),
  });

  onBeforeUnmount(() => {
    // 组合式统一释放场景、控制器与渲染器
    three.dispose();
  });
</script>
  