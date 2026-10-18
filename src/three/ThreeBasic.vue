<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_10"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useElementSize } from '../utils/useElementSize';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// ===== 全局变量 =====
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let canvas = null;
let animationId = null;
let composer = null;
let labelRenderer = null;
let turbineGroup = null;
let particles = null;
let labelResizeObserver = null;
let gui = null;
// 供开关控制的引用
let bloomPass = null;
let platformGroup = null;
let originalFog = null;
let labelObjects = [];
// 灯光引用
let ambientLight = null;
let dirLight = null;
let pointLight = null;
// 模型基准缩放（4/maxDim），用户缩放在此基础上叠加
let baseScale = 1;

// ===== 视觉效果参数（由 lil-gui 绑定） =====
const params = {
  // 显示开关
  bloom: true,
  fresnel: true,
  useBaseMaterial: true,
  edges: true,
  wireframeOnly: false,
  rotation: false,
  particles: true,
  platform: true,
  labels: true,
  fog: true,
  // 模型材质
  shellColor: '#4fc3f7',
  fresnelOpacity: 0.3,
  fresnelExponent: 2,
  centerColorFactor: 0.2,
  centerAlphaFactor: 0.2,
  blending: 'Additive',
  doubleSide: true,
  depthWrite: false,
  baseOpacity: 0.85,
  baseMetalness: 0.3,
  baseRoughness: 0.4,
  // 描边简化
  edgesSimplifyRatio: 0.7,   // SimplifyModifier 保留比例 (0.1~1.0, 1.0=不简化)
  edgesThresholdAngle: 20,    // EdgesGeometry 角度阈值 (1~90 度)
  edgesWeldRatio: 0.006,     // 融并点比例 (0~0.05, 0=不融并)，按 mesh 包围盒尺寸自适应
  // 模型变换
  modelScale: 1.0,
  modelOffsetY: 0,
  // 灯光
  ambientIntensity: 0.5,
  directionalIntensity: 0.8,
  pointIntensity: 0.8,
  pointColor: '#4fc3f7',
  // 后期处理
  bloomStrength: 0.6,
  bloomRadius: 1,
  bloomThreshold: 0.1,
  toneMapping: 'ACES',
  // 场景环境
  bgColor: '#050810',
  fogDensity: 0.035,
  // 动画
  rotationSpeed: 0.003,
  particleFloat: 0.002,
};

// ===== Fresnel 边缘发光 Shader =====
const fresnelVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fresnelFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uExponent;
  uniform float uCenterFactor;
  uniform float uCenterAlpha;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uExponent);
    vec3 color = mix(uColor * uCenterFactor, uColor, fresnel);
    float alpha = mix(uOpacity * uCenterAlpha, uOpacity, fresnel);
    gl_FragColor = vec4(color, alpha);
  }
`;

// 创建透明外壳材质
const createShellMaterial = (color, opacity = 0.5) => {
  return new THREE.ShaderMaterial({
    vertexShader: fresnelVertex,
    fragmentShader: fresnelFragment,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uExponent: { value: params.fresnelExponent },
      uCenterFactor: { value: params.centerColorFactor },
      uCenterAlpha: { value: params.centerAlphaFactor },
    },
    transparent: true,
    depthWrite: params.depthWrite,
    side: params.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    blending: params.blending === 'Additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
};

// 创建圆形粒子贴图
const createParticleTexture = () => {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(120,220,255,0.8)');
  g.addColorStop(1, 'rgba(0,180,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
};

// ===== 描边简化（SimplifyModifier + EdgesGeometry thresholdAngle）=====
const simplifyModifier = new SimplifyModifier();

// 为单个 mesh 创建描边（应用融并点 + 减面 + 角度过滤）
const createEdgesForMesh = (mesh) => {
  try {
    let geo = mesh.geometry;
    // 克隆几何体，避免修改原始数据
    geo = geo.clone();

    // 1. 融并点：按 mesh 包围盒尺寸自适应阈值，消除倒角碎点
    const weldRatio = params.edgesWeldRatio;
    if (weldRatio > 0) {
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const threshold = maxDim * weldRatio;
      if (threshold > 0) {
        const welded = mergeVertices(geo, threshold);
        geo.dispose();
        geo = welded;
      }
    }

    // 2. 减面：SimplifyModifier 移除顶点
    const ratio = params.edgesSimplifyRatio;
    if (ratio < 1.0 && geo.attributes.position && geo.attributes.position.count > 3) {
      const vertexCount = geo.attributes.position.count;
      const removeCount = Math.floor(vertexCount * (1 - ratio));
      if (removeCount > 0) {
        geo = simplifyModifier.modify(geo, removeCount);
      }
    }

    // 3. 减线：EdgesGeometry 按角度阈值过滤
    const edgesGeo = new THREE.EdgesGeometry(geo, params.edgesThresholdAngle);

    geo.dispose();

    return new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.8,
      })
    );
  } catch (e) {
    return null;
  }
};

// 重建所有 mesh 的描边（参数变化时调用）
const rebuildAllEdges = () => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (!child.isMesh) return;
    // 移除旧描边
    if (child.userData.edges) {
      child.remove(child.userData.edges);
      child.userData.edges.geometry.dispose();
      child.userData.edges.material.dispose();
      child.userData.edges = null;
    }
    // 创建新描边
    const edges = createEdgesForMesh(child);
    if (edges) {
      child.userData.edges = edges;
      child.add(edges);
    }
  });
};

// ===== 加载全息 GLB 模型 =====
// 对模型的每个 Mesh 应用 Fresnel 透明材质 + 蓝色发光边缘线
// 同时保存普通替代材质，供 Fresnel 开关切换使用
const applyHolographicMaterial = (model) => {
  const shellColor = 0x4fc3f7;
  model.traverse((child) => {
    if (child.isMesh) {
      // 保存模型原始材质（关闭替代材质时恢复使用）
      child.userData.originalMaterial = child.material;

      // Fresnel 透明外壳材质
      const fresnelMat = createShellMaterial(shellColor, params.fresnelOpacity);
      // 普通替代材质（关闭 Fresnel 且开启替代材质时使用）
      const baseMat = new THREE.MeshStandardMaterial({
        color: shellColor,
        transparent: true,
        opacity: params.baseOpacity,
        metalness: params.baseMetalness,
        roughness: params.baseRoughness,
      });

      // 保存三种材质引用
      child.userData.fresnelMaterial = fresnelMat;
      child.userData.baseMaterial = baseMat;

      // 默认使用 Fresnel 材质
      child.material = fresnelMat;

      // 添加蓝色发光边缘线（支持简化）
      const edges = createEdgesForMesh(child);
      if (edges) {
        child.userData.edges = edges;
        child.add(edges);
      }
    }
  });
};

// 加载并居中/缩放模型，返回模型与包围盒中心
const loadHolographicModel = () => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      'static/holographicModel/1号直流变电柜.glb',
      (gltf) => {
        const model = gltf.scene;

        // 应用全息材质
        applyHolographicMaterial(model);

        // 计算包围盒，用于居中和缩放
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // 缩放到合适尺寸（最大边约为 4）
        const maxDim = Math.max(size.x, size.y, size.z);
        baseScale = 4 / maxDim;
        model.scale.setScalar(baseScale * params.modelScale);

        // 重新计算缩放后的包围盒以精确居中
        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // 让模型底部落在平台上 (平台 y=-1.25)，并水平居中
        model.position.x -= scaledCenter.x;
        model.position.z -= scaledCenter.z;
        model.position.y -= scaledBox.min.y; // 底部对齐到 y=0
        model.position.y -= 1.25; // 下移到平台
        // 保存基准 Y，供 modelOffsetY 叠加
        model.userData.baseY = model.position.y;
        model.position.y += params.modelOffsetY;

        // 计算顶部位置（用于标签）
        const topY = scaledBox.max.y - scaledBox.min.y - 1.25 + 0.5;

        resolve({ model, topY });
      },
      undefined,
      (error) => {
        console.error('模型加载失败:', error);
        reject(error);
      }
    );
  });
};

// ===== 创建背景粒子 =====
const createParticles = () => {
  const count = 400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.15,
    map: createParticleTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0x4fc3f7,
  });
  return new THREE.Points(geo, mat);
};

// ===== 创建平台地面 =====
const createPlatform = () => {
  const g = new THREE.Group();

  // 半透明平台
  const planeGeo = new THREE.PlaneGeometry(14, 6);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x1565c0,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1.26;
  g.add(plane);

  // 平台边缘发光线
  const edgePts = [
    new THREE.Vector3(-7, -1.25, -3),
    new THREE.Vector3(7, -1.25, -3),
    new THREE.Vector3(7, -1.25, 3),
    new THREE.Vector3(-7, -1.25, 3),
    new THREE.Vector3(-7, -1.25, -3),
  ];
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9 });
  g.add(new THREE.Line(edgeGeo, edgeMat));

  // 网格
  const grid = new THREE.GridHelper(14, 14, 0x1976d2, 0x0d47a1);
  grid.position.y = -1.25;
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  g.add(grid);

  // 底部光环
  const ringGeo = new THREE.RingGeometry(5.5, 6, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x29b6f6,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.3;
  g.add(ring);

  return g;
};

// ===== 创建 CSS2D 文字标注 =====
const createLabels = (topY = 2) => {
  const labels = [
    { text: '1号直流变电柜', pos: new THREE.Vector3(0, topY, 0) },
  ];

  const labelObjects = [];
  labels.forEach(({ text, pos }) => {
    const div = document.createElement('div');
    div.className = 'turbine-label';
    div.textContent = text;
    const label = new CSS2DObject(div);
    label.position.copy(pos);
    labelObjects.push(label);
  });
  return labelObjects;
};

// ===== 视觉效果开关处理函数 =====
const toggleBloom = (val) => {
  if (bloomPass) bloomPass.enabled = val;
};

const toggleParticles = (val) => {
  if (particles) particles.visible = val;
};

const togglePlatform = (val) => {
  if (platformGroup) platformGroup.visible = val;
};

const toggleEdges = (val) => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (child.isMesh && child.userData.edges) {
      child.userData.edges.visible = val;
    }
  });
};

// 线框单独显示：隐藏实体材质，只保留描边线框
// 注意：不能设置 mesh.visible=false，否则子对象 edges 也会被隐藏
// 改用 material.visible=false 隐藏材质，mesh 对象本身保持可见
const toggleWireframeOnly = (val) => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (child.isMesh) {
      // 切换三种材质的可见性
      const mats = [
        child.userData.fresnelMaterial,
        child.userData.baseMaterial,
        child.userData.originalMaterial,
      ];
      mats.forEach((m) => {
        if (!m) return;
        if (Array.isArray(m)) {
          m.forEach((mm) => { mm.visible = !val; });
        } else {
          m.visible = !val;
        }
      });
      // 线框模式下强制显示描边；关闭时按 params.edges 决定
      if (child.userData.edges) {
        child.userData.edges.visible = val ? true : params.edges;
      }
    }
  });
};

const toggleLabels = (val) => {
  if (labelRenderer && labelRenderer.domElement) {
    labelRenderer.domElement.style.display = val ? '' : 'none';
  }
};

const toggleFog = (val) => {
  if (scene) {
    scene.fog = val ? originalFog : null;
  }
};

// Fresnel 材质开关：开启时用 Fresnel 材质；关闭时根据 useBaseMaterial 决定用替代材质或原始材质
const toggleFresnel = (val) => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (child.isMesh && child.userData.fresnelMaterial) {
      if (val) {
        child.material = child.userData.fresnelMaterial;
      } else {
        // 关闭 Fresnel 时，根据 useBaseMaterial 选择替代材质或模型原始材质
        child.material = params.useBaseMaterial
          ? child.userData.baseMaterial
          : child.userData.originalMaterial;
      }
    }
  });
};

// 替代材质开关：关闭时，关闭 Fresnel 后使用模型自带的原始材质
const toggleUseBaseMaterial = (val) => {
  params.useBaseMaterial = val;
  // 如果当前 Fresnel 处于关闭状态，立即切换材质
  if (!params.fresnel) {
    toggleFresnel(false);
  }
};

// ===== 批量更新材质辅助函数 =====
// 遍历模型所有 mesh，对 Fresnel 材质执行回调
const updateFresnelMaterials = (callback) => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (child.isMesh && child.userData.fresnelMaterial) {
      callback(child.userData.fresnelMaterial);
    }
  });
};

// 遍历模型所有 mesh，对替代材质执行回调
const updateBaseMaterials = (callback) => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (child.isMesh && child.userData.baseMaterial) {
      callback(child.userData.baseMaterial);
    }
  });
};

// ===== 材质参数更新函数 =====
const updateShellColor = (val) => {
  const c = new THREE.Color(val);
  updateFresnelMaterials((m) => m.uniforms.uColor.value.copy(c));
  updateBaseMaterials((m) => m.color.copy(c));
};

const updateFresnelOpacity = (val) => {
  updateFresnelMaterials((m) => { m.uniforms.uOpacity.value = val; });
};

const updateFresnelExponent = (val) => {
  updateFresnelMaterials((m) => { m.uniforms.uExponent.value = val; });
};

const updateCenterColorFactor = (val) => {
  updateFresnelMaterials((m) => { m.uniforms.uCenterFactor.value = val; });
};

const updateCenterAlphaFactor = (val) => {
  updateFresnelMaterials((m) => { m.uniforms.uCenterAlpha.value = val; });
};

const updateBlending = (val) => {
  const blending = val === 'Additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
  updateFresnelMaterials((m) => {
    m.blending = blending;
    m.needsUpdate = true;
  });
};

const updateDoubleSide = (val) => {
  updateFresnelMaterials((m) => {
    m.side = val ? THREE.DoubleSide : THREE.FrontSide;
    m.needsUpdate = true;
  });
};

const updateDepthWrite = (val) => {
  if (!turbineGroup) return;
  turbineGroup.traverse((child) => {
    if (child.isMesh) {
      // Fresnel 材质
      if (child.userData.fresnelMaterial) {
        child.userData.fresnelMaterial.depthWrite = val;
        child.userData.fresnelMaterial.needsUpdate = true;
      }
      // 替代材质
      if (child.userData.baseMaterial) {
        child.userData.baseMaterial.depthWrite = val;
        child.userData.baseMaterial.needsUpdate = true;
      }
      // 模型原始材质
      if (child.userData.originalMaterial) {
        const om = child.userData.originalMaterial;
        if (Array.isArray(om)) {
          om.forEach((m) => { m.depthWrite = val; m.needsUpdate = true; });
        } else {
          om.depthWrite = val;
          om.needsUpdate = true;
        }
      }
    }
    // 描边线材质（通过 userData.edges 引用）
    if (child.isMesh && child.userData.edges && child.userData.edges.material) {
      child.userData.edges.material.depthWrite = val;
      child.userData.edges.material.needsUpdate = true;
    }
  });
};

const updateBaseOpacity = (val) => {
  updateBaseMaterials((m) => { m.opacity = val; });
};

const updateBaseMetalness = (val) => {
  updateBaseMaterials((m) => { m.metalness = val; });
};

const updateBaseRoughness = (val) => {
  updateBaseMaterials((m) => { m.roughness = val; });
};

// ===== 模型变换更新函数 =====
const updateModelScale = (val) => {
  if (turbineGroup) turbineGroup.scale.setScalar(baseScale * val);
};

const updateModelOffsetY = (val) => {
  if (turbineGroup && turbineGroup.userData.baseY !== undefined) {
    turbineGroup.position.y = turbineGroup.userData.baseY + val;
  }
};

// ===== 灯光更新函数 =====
const updateAmbientIntensity = (val) => {
  if (ambientLight) ambientLight.intensity = val;
};

const updateDirectionalIntensity = (val) => {
  if (dirLight) dirLight.intensity = val;
};

const updatePointIntensity = (val) => {
  if (pointLight) pointLight.intensity = val;
};

const updatePointColor = (val) => {
  if (pointLight) pointLight.color.set(val);
};

// ===== 后期处理更新函数 =====
const updateBloomStrength = (val) => {
  if (bloomPass) bloomPass.strength = val;
};

const updateBloomRadius = (val) => {
  if (bloomPass) bloomPass.radius = val;
};

const updateBloomThreshold = (val) => {
  if (bloomPass) bloomPass.threshold = val;
};

const updateToneMapping = (val) => {
  if (!renderer) return;
  const map = {
    ACES: THREE.ACESFilmicToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Cineon: THREE.CineonToneMapping,
  };
  renderer.toneMapping = map[val] || THREE.ACESFilmicToneMapping;
};

// ===== 场景环境更新函数 =====
const updateBgColor = (val) => {
  if (scene) scene.background.set(val);
};

const updateFogDensity = (val) => {
  if (originalFog) originalFog.density = val;
};

// ===== 创建 lil-gui 调试面板 =====
const setupGUI = () => {
  if (gui) gui.destroy();
  gui = new GUI({ title: '视觉效果控制' });

  // —— 显示开关 ——
  const fToggle = gui.addFolder('显示开关');
  fToggle.add(params, 'bloom').name('泛光 Bloom').onChange(toggleBloom);
  fToggle.add(params, 'fresnel').name('Fresnel 材质').onChange(toggleFresnel);
  fToggle.add(params, 'useBaseMaterial').name('使用替代材质').onChange(toggleUseBaseMaterial);
  fToggle.add(params, 'edges').name('模型描边').onChange(toggleEdges);
  fToggle.add(params, 'wireframeOnly').name('仅线框显示').onChange(toggleWireframeOnly);
  fToggle.add(params, 'rotation').name('模型旋转');
  fToggle.add(params, 'particles').name('背景粒子').onChange(toggleParticles);
  fToggle.add(params, 'platform').name('平台网格').onChange(togglePlatform);
  fToggle.add(params, 'labels').name('文字标注').onChange(toggleLabels);
  fToggle.add(params, 'fog').name('场景雾效').onChange(toggleFog);

  // —— 模型材质 ——
  const fMat = gui.addFolder('模型材质');
  fMat.addColor(params, 'shellColor').name('外壳颜色').onChange(updateShellColor);
  fMat.add(params, 'fresnelOpacity', 0, 1, 0.01).name('Fresnel 透明度').onChange(updateFresnelOpacity);
  fMat.add(params, 'fresnelExponent', 0.5, 8, 0.1).name('Fresnel 指数').onChange(updateFresnelExponent);
  fMat.add(params, 'centerColorFactor', 0, 1, 0.01).name('中心亮度系数').onChange(updateCenterColorFactor);
  fMat.add(params, 'centerAlphaFactor', 0, 1, 0.01).name('中心透明度系数').onChange(updateCenterAlphaFactor);
  fMat.add(params, 'blending', { Additive: 'Additive', Normal: 'Normal' }).name('混合模式').onChange(updateBlending);
  fMat.add(params, 'doubleSide').name('双面渲染').onChange(updateDoubleSide);
  fMat.add(params, 'depthWrite').name('深度写入').onChange(updateDepthWrite);
  fMat.add(params, 'baseOpacity', 0, 1, 0.01).name('替代材质透明度').onChange(updateBaseOpacity);
  fMat.add(params, 'baseMetalness', 0, 1, 0.01).name('替代材质金属度').onChange(updateBaseMetalness);
  fMat.add(params, 'baseRoughness', 0, 1, 0.01).name('替代材质粗糙度').onChange(updateBaseRoughness);

  // —— 描边简化 ——
  const fEdge = gui.addFolder('描边简化');
  fEdge.add(params, 'edgesSimplifyRatio', 0.1, 1.0, 0.05).name('减面保留比例').onChange(rebuildAllEdges);
  fEdge.add(params, 'edgesThresholdAngle', 1, 90, 1).name('角度阈值').onChange(rebuildAllEdges);
  fEdge.add(params, 'edgesWeldRatio', 0, 0.05, 0.001).name('融并比例').onChange(rebuildAllEdges);

  // —— 模型变换 ——
  const fTrans = gui.addFolder('模型变换');
  fTrans.add(params, 'modelScale', 0.5, 8, 0.1).name('模型缩放').onChange(updateModelScale);
  fTrans.add(params, 'modelOffsetY', -2, 2, 0.05).name('上下偏移').onChange(updateModelOffsetY);

  // —— 灯光系统 ——
  const fLight = gui.addFolder('灯光系统');
  fLight.add(params, 'ambientIntensity', 0, 3, 0.05).name('环境光强度').onChange(updateAmbientIntensity);
  fLight.add(params, 'directionalIntensity', 0, 3, 0.05).name('平行光强度').onChange(updateDirectionalIntensity);
  fLight.add(params, 'pointIntensity', 0, 3, 0.05).name('补光点光强度').onChange(updatePointIntensity);
  fLight.addColor(params, 'pointColor').name('补光点光颜色').onChange(updatePointColor);

  // —— 后期处理 ——
  const fPost = gui.addFolder('后期处理');
  fPost.add(params, 'bloomStrength', 0, 3, 0.05).name('Bloom 强度').onChange(updateBloomStrength);
  fPost.add(params, 'bloomRadius', 0, 1, 0.01).name('Bloom 半径').onChange(updateBloomRadius);
  fPost.add(params, 'bloomThreshold', 0, 1, 0.01).name('Bloom 阈值').onChange(updateBloomThreshold);
  fPost.add(params, 'toneMapping', { ACES: 'ACES', Linear: 'Linear', Reinhard: 'Reinhard', Cineon: 'Cineon' }).name('色调映射').onChange(updateToneMapping);

  // —— 场景环境 ——
  const fEnv = gui.addFolder('场景环境');
  fEnv.addColor(params, 'bgColor').name('背景颜色').onChange(updateBgColor);
  fEnv.add(params, 'fogDensity', 0, 0.1, 0.001).name('雾密度').onChange(updateFogDensity);

  // —— 动画 ——
  const fAnim = gui.addFolder('动画');
  fAnim.add(params, 'rotationSpeed', 0, 0.02, 0.001).name('旋转速度');
  fAnim.add(params, 'particleFloat', 0, 0.01, 0.0005).name('粒子漂浮幅度');
};

// ===== 初始化 =====
const init = () => {
  const { elementSize, updateElementSize, bindRenderer } = useElementSize('.three-container');
  updateElementSize();

  canvas = document.querySelector('.webgl_10');

  // 场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(params.bgColor);
  originalFog = new THREE.FogExp2(params.bgColor, params.fogDensity);
  scene.fog = originalFog;

  // 相机
  camera = new THREE.PerspectiveCamera(
    50,
    elementSize.value.width / elementSize.value.height,
    0.1,
    1000
  );
  camera.position.set(2, 3.5, 10);
  camera.lookAt(0, 0, 0);

  // 控制器
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 6;
  controls.maxDistance = 22;
  controls.target.set(0, 0, 0);

  // 渲染器
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(elementSize.value.width, elementSize.value.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 默认色调映射与 params 一致
  updateToneMapping(params.toneMapping);

  bindRenderer(renderer, camera);

  // ===== 后期处理：Bloom =====
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(elementSize.value.width, elementSize.value.height),
    params.bloomStrength,
    params.bloomRadius,
    params.bloomThreshold
  );
  composer.addPass(bloomPass);

  // ===== CSS2D 标注渲染器 =====
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(elementSize.value.width, elementSize.value.height);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  canvas.parentElement.appendChild(labelRenderer.domElement);

  // 监听容器尺寸变化，同步 composer 与 labelRenderer
  const container = document.querySelector('.three-container');
  if (container) {
    labelResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (composer) composer.setSize(width, height);
        if (labelRenderer) labelRenderer.setSize(width, height);
      }
    });
    labelResizeObserver.observe(container);
  }

  // ===== 灯光 =====
  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
  scene.add(ambientLight);
  dirLight = new THREE.DirectionalLight(0xffffff, params.directionalIntensity);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
  // 内部补光，让透明外壳有层次
  pointLight = new THREE.PointLight(0x4fc3f7, params.pointIntensity, 20);
  pointLight.color.set(params.pointColor);
  pointLight.position.set(0, 2, 3);
  scene.add(pointLight);

  // ===== 构建场景内容 =====
  platformGroup = createPlatform();
  scene.add(platformGroup);

  particles = createParticles();
  scene.add(particles);

  // 异步加载 GLB 模型，加载完成后添加到场景并创建标签
  loadHolographicModel()
    .then(({ model, topY }) => {
      turbineGroup = model;
      scene.add(model);
      // 根据模型实际顶部高度放置标签
      labelObjects = createLabels(topY);
      labelObjects.forEach((l) => scene.add(l));
      // 模型加载完成后创建调试面板
      setupGUI();
    })
    .catch((err) => {
      console.warn('全息模型加载失败，场景将仅保留平台与粒子', err);
    });

  // ===== 动画循环 =====
  const clock = new THREE.Clock();
  const tick = () => {
    const t = clock.getElapsedTime();

    // 模型整体缓慢旋转（展示效果）
    if (turbineGroup && params.rotation) {
      turbineGroup.rotation.y += params.rotationSpeed;
    }

    // 粒子缓慢漂浮
    if (particles) {
      particles.rotation.y = t * 0.02;
      const pos = particles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y += Math.sin(t * 0.5 + i) * params.particleFloat;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
    animationId = requestAnimationFrame(tick);
  };
  tick();
};

// ===== 卸载清理 =====
onBeforeUnmount(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (labelResizeObserver) {
    labelResizeObserver.disconnect();
    labelResizeObserver = null;
  }

  // 销毁 lil-gui 面板
  try {
    if (gui) gui.destroy();
  } catch (e) {}
  gui = null;

  try {
    if (controls) controls.dispose();
  } catch (e) {}
  controls = null;

  // 清理场景对象
  if (scene) {
    const children = [...scene.children];
    children.forEach((child) => {
      try {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
        scene.remove(child);
      } catch (e) {}
    });
  }
  scene = null;
  turbineGroup = null;
  particles = null;
  bloomPass = null;
  platformGroup = null;
  originalFog = null;
  labelObjects = [];
  ambientLight = null;
  dirLight = null;
  pointLight = null;
  baseScale = 1;

  try {
    if (composer) composer.dispose();
  } catch (e) {}
  composer = null;

  try {
    if (labelRenderer) {
      if (labelRenderer.domElement && labelRenderer.domElement.parentElement) {
        labelRenderer.domElement.parentElement.removeChild(labelRenderer.domElement);
      }
    }
  } catch (e) {}
  labelRenderer = null;

  try {
    if (renderer) renderer.dispose();
  } catch (e) {}
  renderer = null;
  camera = null;
  canvas = null;
});

onMounted(() => {
  init();
});
</script>

<style scoped>
.three-container {
  position: relative;
}
.webgl_10 {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

<style>
/* CSS2D 标注样式（全局，因为 labelRenderer 的 DOM 在 scoped 外） */
.turbine-label {
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  text-shadow: 0 0 8px rgba(79, 195, 247, 0.9), 0 0 16px rgba(79, 195, 247, 0.5);
  padding: 4px 10px;
  background: rgba(10, 25, 47, 0.6);
  border: 1px solid rgba(79, 195, 247, 0.6);
  border-radius: 3px;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
</style>
