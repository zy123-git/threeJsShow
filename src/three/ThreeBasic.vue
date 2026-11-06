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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';

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
let outlinePass = null;
let platformGroup = null;
let originalFog = null;
let labelObjects = [];
// 灯光引用
let ambientLight = null;
let dirLight = null;
let pointLight = null;
// 模型基准缩放（4/maxDim），用户缩放在此基础上叠加
let baseScale = 1;

// 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
const assetToken = beginAssetLoading();

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
  // 轮廓描边（屏幕空间法线 + 深度边缘检测）
  edgeThickness: 1.2,     // 采样半径（像素），约等于线宽
  edgeDepthDiff: 0.03,    // 相对深度差阈值
  edgeNormalDiff: 0.28,   // 法线向量差阈值
  edgeColor: '#4fc3f7',
  edgeOpacity: 0.9,
  edgeFresnelExponent: 2,
  edgeFresnelInfluence: 0.5,
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

// ===== 屏幕空间轮廓描边（法线 + 深度边缘检测）=====
// 原理：
// 1) 每帧先把模型单独渲染成一张法线图并顺带拿到深度图：
//    用 MeshNormalMaterial 作为 scene.overrideMaterial，相机临时只启用第 1 层，
//    因此只有模型网格参与，平台/粒子/其它线不会污染这张图。
// 2) 全屏 Shader 做 4 邻域比较：深度先线性化再求相对差，同时比较法线向量差，
//    任一超过阈值即判定为轮廓像素。
// 3) 把描边色按不透明度叠回 RenderPass 的画面。
// 因为线是在屏幕空间按像素求出来的，不依赖三角面拓扑，所以不会出现碎线、
// 内部乱线或描边与实体错位的问题，转动相机时轮廓也始终贴合。

const outlineVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const outlineFragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uThickness;
  uniform float uDepthDiff;
  uniform float uNormalDiff;
  uniform vec3 uEdgeColor;
  uniform float uEdgeOpacity;
  uniform float uEdgeFresnelExponent;
  uniform float uEdgeFresnelInfluence;
  varying vec2 vUv;

  // 深度图存的是非线性 [0,1]，换算成到相机的线性距离
  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  void main() {
    vec4 base = texture2D(tDiffuse, vUv);
    vec2 texel = uThickness / uResolution;

    float d0 = linearDepth(vUv);
    vec3 n0 = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);

    vec2 offsets[4];
    offsets[0] = vec2(texel.x, 0.0);
    offsets[1] = vec2(-texel.x, 0.0);
    offsets[2] = vec2(0.0, texel.y);
    offsets[3] = vec2(0.0, -texel.y);

    float maxDepthRel = 0.0;
    float maxNormalDiff = 0.0;
    // 中心与四邻域中最近表面的法线，避免描边像素落在背景上导致菲涅尔亮度断裂
    float nearestDepth = d0;
    vec3 nearestNormal = n0;

    for (int i = 0; i < 4; i++) {
      vec2 uv = vUv + offsets[i];
      float di = linearDepth(uv);
      vec3 ni = normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);
      maxDepthRel = max(maxDepthRel, abs(di - d0) / max(d0, 1e-3));
      maxNormalDiff = max(maxNormalDiff, length(ni - n0));
      if (di < nearestDepth) {
        nearestDepth = di;
        nearestNormal = ni;
      }
    }

    float depthEdge = smoothstep(uDepthDiff, uDepthDiff * 1.8, maxDepthRel);
    float normalEdge = smoothstep(uNormalDiff, uNormalDiff * 1.6, maxNormalDiff);
    float edge = max(depthEdge, normalEdge);

    // 线框菲涅尔：全屏阶段视线在视空间恒为 (0,0,1)，掠射面更亮、正视面更淡
    float fresnel = pow(clamp(1.0 - abs(nearestNormal.z), 0.0, 1.0), uEdgeFresnelExponent);
    float edgeAlpha = edge * uEdgeOpacity * mix(1.0, fresnel, uEdgeFresnelInfluence);

    gl_FragColor = vec4(mix(base.rgb, uEdgeColor, edgeAlpha), base.a);
  }
`;

class OutlineEdgePass extends Pass {
  constructor(scene, camera, width, height) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = true;

    const depthTexture = new THREE.DepthTexture();
    depthTexture.format = THREE.DepthStencilFormat;
    depthTexture.type = THREE.UnsignedInt248Type;

    this.normalRenderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthTexture,
    });

    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.normalMaterial.blending = THREE.NoBlending;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tNormal: { value: this.normalRenderTarget.texture },
        tDepth: { value: this.normalRenderTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uThickness: { value: params.edgeThickness },
        uDepthDiff: { value: params.edgeDepthDiff },
        uNormalDiff: { value: params.edgeNormalDiff },
        uEdgeColor: { value: new THREE.Color(params.edgeColor) },
        uEdgeOpacity: { value: params.edgeOpacity },
        uEdgeFresnelExponent: { value: params.edgeFresnelExponent },
        uEdgeFresnelInfluence: { value: params.edgeFresnelInfluence },
      },
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    this.fsQuad = new FullScreenQuad(this.material);

    this._clearColor = new THREE.Color();
    this._outlineLayers = new THREE.Layers();
    this._outlineLayers.set(1);
  }

  setSize(width, height) {
    this.normalRenderTarget.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  // 线框模式会把实体材质的 visible 设为 false，法线通道需要模型照常参与，临时打开再还原
  _forceMaterialVisible(visible) {
    const changed = [];
    this.scene.traverse((obj) => {
      if (!obj.isMesh || !obj.layers.test(this._outlineLayers)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m && m.visible === !visible) {
          m.visible = visible;
          changed.push(m);
        }
      });
    });
    return changed;
  }

  render(renderer, writeBuffer, readBuffer) {
    // ① 法线 + 深度：相机临时只启用第 1 层（模型网格）
    const savedLayerMask = this.camera.layers.mask;
    this.camera.layers.set(1);

    const savedAutoClear = renderer.autoClear;
    renderer.getClearColor(this._clearColor);
    const savedClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(this.normalRenderTarget);
    renderer.autoClear = false;
    renderer.setClearColor(0x7777ff, 1.0);
    renderer.clear();

    const changedMats = this._forceMaterialVisible(true);
    this.scene.overrideMaterial = this.normalMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    changedMats.forEach((m) => { m.visible = false; });

    renderer.autoClear = savedAutoClear;
    renderer.setClearColor(this._clearColor, savedClearAlpha);
    this.camera.layers.mask = savedLayerMask;

    // ② 把轮廓叠回画面
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.normalRenderTarget.dispose();
    this.normalMaterial.dispose();
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

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

      // 轮廓描边单独用法线/深度通道，用第 1 层标记模型网格
      child.layers.enable(1);
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
        endAssetLoading(assetToken);
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
      (xhr) => {
        reportAssetProgress(assetToken, xhr.loaded, xhr.total);
      },
      (error) => {
        endAssetLoading(assetToken);
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
  if (outlinePass) outlinePass.enabled = val;
};

// 线框单独显示：隐藏实体材质，只保留屏幕空间轮廓
// 注意：不能设置 mesh.visible=false，否则模型不会参与法线/深度通道，轮廓也会一起消失
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

  // —— 轮廓描边 ——
  const fEdge = gui.addFolder('轮廓描边');
  fEdge.add(params, 'edgeThickness', 0.5, 4, 0.1).name('线宽(像素)').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uThickness.value = v;
  });
  fEdge.add(params, 'edgeDepthDiff', 0.005, 0.2, 0.001).name('深度阈值').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uDepthDiff.value = v;
  });
  fEdge.add(params, 'edgeNormalDiff', 0.05, 1, 0.01).name('法线阈值').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uNormalDiff.value = v;
  });
  fEdge.add(params, 'edgeOpacity', 0, 1, 0.01).name('描边不透明度').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeOpacity.value = v;
  });
  fEdge.add(params, 'edgeFresnelExponent', 0.5, 8, 0.1).name('线框菲涅尔指数').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeFresnelExponent.value = v;
  });
  fEdge.add(params, 'edgeFresnelInfluence', 0, 1, 0.01).name('线框菲涅尔强度').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeFresnelInfluence.value = v;
  });
  fEdge.addColor(params, 'edgeColor').name('描边颜色').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeColor.value.set(v);
  });

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
  controls.minDistance = 1;
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

  // ===== 后期处理：RenderPass → 轮廓描边 → Bloom =====
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  outlinePass = new OutlineEdgePass(scene, camera, elementSize.value.width, elementSize.value.height);
  composer.addPass(outlinePass);
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
    if (outlinePass) outlinePass.dispose();
  } catch (e) {}
  outlinePass = null;

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
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
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
