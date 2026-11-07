<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_10"></canvas>

    <!-- 左上角性能面板（样式参考几何数据面板） -->
    <div class="perf-panel">
      <div class="perf-panel__inner">
        <span class="perf-accent perf-accent--tl"></span>
        <span class="perf-accent perf-accent--tr"></span>
        <span class="perf-accent perf-accent--br"></span>
        <span class="perf-accent perf-accent--bl"></span>

        <div class="perf-head">
          <div class="perf-title">性能数据</div>
          <div class="perf-subtitle">PERFORMANCE</div>
        </div>

        <div class="perf-divider"></div>

        <div class="perf-row">
          <span class="perf-label">帧率<em>FPS</em></span>
          <span ref="fpsValueRef" class="perf-value">--</span>
        </div>
        <div class="perf-row">
          <span class="perf-label">绘制调用<em>DRAW CALLS</em></span>
          <span ref="drawCallsValueRef" class="perf-value">--</span>
        </div>

        <div class="perf-chart-label">帧率历史<em>FPS HISTORY</em></div>
        <canvas ref="fpsChartRef" class="perf-chart"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
let backdropPass = null;
let originalFog = null;
let labelObjects = [];
// 灯光引用
let ambientLight = null;
let dirLight = null;
let pointLight = null;
// 模型基准缩放（4/maxDim），用户缩放在此基础上叠加
let baseScale = 1;
// 柜体点击后的几何数据面板
let geometryPanelGroup = null;
let geometryPanelMesh = null;
let geometryPanelTexture = null;
let geometryPanelMaterial = null;
let geometryStats = null;
let geometryStatsIdle = null;
let pendingPointer = null;
const geometryRaycaster = new THREE.Raycaster();
const geometryPointerNdc = new THREE.Vector2();
// 面板在模型局部坐标中的锚点与朝向
const geometryPanelLocalPosition = new THREE.Vector3();
const geometryPanelLocalQuaternion = new THREE.Quaternion();
const geometryPanelWorldQuaternion = new THREE.Quaternion();
// 左上角性能面板：DOM 引用与采样状态
const fpsValueRef = ref(null);
const drawCallsValueRef = ref(null);
const fpsChartRef = ref(null);
const FPS_HISTORY_SIZE = 40;      // 历史样本数（每 0.5s 一个，约 20s）
const FPS_SAMPLE_INTERVAL = 500;  // 采样间隔（毫秒）
const fpsHistory = [];
let perfFrameCount = 0;
let perfSampleStart = 0;
let perfDrawCalls = 0;

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
  labels: true,
  fog: true,
  // 模型材质
  shellColor: '#d1f1ff',
  fresnelOpacity: 0.2,
  fresnelExponent: 8,
  centerColorFactor: 0.33,
  centerAlphaFactor: 0.1,
  blending: 'Screen',
  doubleSide: true,
  depthWrite: true,
  baseOpacity: 0.85,
  baseMetalness: 0.3,
  baseRoughness: 0.4,
  // 轮廓描边（屏幕空间法线 + 深度边缘检测）
  edgeThickness: 1.2,       // 采样半径（像素），约等于线宽
  edgeDepthDiff: 0.2,     // 相对深度差阈值
  edgeNormalDiff: 0.28,   // 法线向量差阈值
  edgeColor: '#6dcffd',
  edgeColorInner: '#bec6cb',  // 内部折痕描边颜色（与外框区分）
  edgeOpacity: 1,
  edgeIntensity: 3.5,       // 外框（剪影）描边亮度（>1 为 HDR 高亮）
  edgeIntensityInner: 1.8,  // 内框（折痕）描边亮度
  edgeFresnelExponent: 0.5,
  edgeFresnelInfluence: 0.1,
  edgeSilhouetteWidth: 2.5,  // 剪影采样宽度倍率（稀疏区域用更宽采样）
  edgeCreaseOpacity: 0.65,   // 折痕边不透明度
  edgeDetailFade: 0.6,       // 密集区域细节边的抑制强度
  edgeGlowStrength: 1,       // 描边光晕强度
  edgeGlowRadius: 3.5,         // 描边光晕半径（像素）
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
  bloomThreshold: 0.5,
  toneMapping: 'ACES',
  // 场景环境
  bgColor: '#6e7a96',
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
    // 预乘 alpha，配合下方 CustomBlending 的因子使三种混合模式都正确感知透明度
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

// 菲涅尔壳混合模式（统一使用预乘 alpha）：
// shader 输出 color*alpha，混合因子全部按预乘约定设置，保证透明度正确参与合成
// - Additive：color*alpha + dst（叠加发光，亮背景易过曝）
// - Screen：color*alpha*(1-dst) + dst（暗区叠加、亮区不叠加，避免亮底过曝，默认）
// - Normal：color*alpha + dst*(1-alpha)（普通 alpha 混合，最不发光）
const getShellBlending = (mode) => {
  if (mode === 'Additive') {
    return {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    };
  }
  if (mode === 'Screen') {
    return {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneMinusDstColorFactor,
      blendDst: THREE.OneFactor,
    };
  }
  return {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  };
};

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
    ...getShellBlending(params.blending),
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
  uniform vec3 uEdgeColorInner;
  uniform float uEdgeIntensity;
  uniform float uEdgeOpacity;
  uniform float uEdgeFresnelExponent;
  uniform float uEdgeFresnelInfluence;
  uniform float uSilhouetteScale;
  uniform float uCreaseOpacity;
  uniform float uDetailFade;
  uniform float uEdgeIntensityInner;
  uniform sampler2D tEdgeMask;
  uniform sampler2D tGlow;
  uniform float uGlowStrength;
  varying vec2 vUv;

  // 深度图存的是非线性 [0,1]，换算成到相机的线性距离
  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  // 背景像素（清屏深度）一律视为朝向相机的中性法线，
  // 避免法线通道的底色被场景背景色污染，导致描边强弱随背景色变化
  vec3 safeNormal(vec2 uv) {
    if (linearDepth(uv) >= uFar * 0.999) return vec3(0.0, 0.0, 1.0);
    return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);
  }

  // 在指定像素半径上采样深度/法线边，并记录最近表面的法线
  void sampleEdges(vec2 uv, float radiusPixels, out float depthEdge, out float normalEdge, out vec3 nearestNormal) {
    float d0 = linearDepth(uv);
    vec3 n0 = safeNormal(uv);
    vec2 texel = radiusPixels / uResolution;

    vec2 offsets[4];
    offsets[0] = vec2(texel.x, 0.0);
    offsets[1] = vec2(-texel.x, 0.0);
    offsets[2] = vec2(0.0, texel.y);
    offsets[3] = vec2(0.0, -texel.y);

    float maxDepthRel = 0.0;
    float maxNormalDiff = 0.0;
    float nearestDepth = d0;
    nearestNormal = n0;

    for (int i = 0; i < 4; i++) {
      vec2 suv = uv + offsets[i];
      float di = linearDepth(suv);
      vec3 ni = safeNormal(suv);
      maxDepthRel = max(maxDepthRel, abs(di - d0) / max(d0, 1e-3));
      maxNormalDiff = max(maxNormalDiff, length(ni - n0));
      if (di < nearestDepth) {
        nearestDepth = di;
        nearestNormal = ni;
      }
    }

    depthEdge = smoothstep(uDepthDiff, uDepthDiff * 1.8, maxDepthRel);
    normalEdge = smoothstep(uNormalDiff, uNormalDiff * 1.6, maxNormalDiff);
  }

  // 仅统计同一深度层内的法线差异，避免把背景误判成“密集区域”
  void addNormalSpread(vec2 uv, vec2 offset, float d0, vec3 n0, inout float spread, inout float count) {
    vec2 suv = uv + offset;
    float di = linearDepth(suv);
    if (abs(di - d0) / max(d0, 1e-3) < 0.05) {
      vec3 ni = safeNormal(suv);
      spread += length(ni - n0);
      count += 1.0;
    }
  }

  // 邻域法线离散度：越大说明该区域网格越密集、细节越多
  float localNormalSpread(vec2 uv) {
    float d0 = linearDepth(uv);
    vec3 n0 = safeNormal(uv);
    float radius = max(uThickness * 6.0, 6.0);
    vec2 texel = radius / uResolution;

    float spread = 0.0;
    float count = 0.0;
    addNormalSpread(uv, vec2(texel.x, 0.0), d0, n0, spread, count);
    addNormalSpread(uv, vec2(-texel.x, 0.0), d0, n0, spread, count);
    addNormalSpread(uv, vec2(0.0, texel.y), d0, n0, spread, count);
    addNormalSpread(uv, vec2(0.0, -texel.y), d0, n0, spread, count);
    addNormalSpread(uv, vec2(texel.x, texel.y), d0, n0, spread, count);
    addNormalSpread(uv, vec2(-texel.x, texel.y), d0, n0, spread, count);
    addNormalSpread(uv, vec2(texel.x, -texel.y), d0, n0, spread, count);
    addNormalSpread(uv, vec2(-texel.x, -texel.y), d0, n0, spread, count);

    return count > 0.0 ? spread / count : 0.0;
  }

  void main() {
    // 局部密度：稀疏的大面降低抑制，密集小网格提高抑制
    float density = smoothstep(0.12, 0.55, localNormalSpread(vUv));
    float creaseWeight = mix(1.0, 1.0 - uDetailFade, density);

    // 剪影层：稀疏区域用更宽采样，密集区域自动收窄
    float silhouetteRadius = uThickness * mix(uSilhouetteScale, 1.0, density);
    float silhouetteDepth, silhouetteNormal;
    vec3 silhouetteNearest;
    sampleEdges(vUv, silhouetteRadius, silhouetteDepth, silhouetteNormal, silhouetteNearest);

    // 折痕层：固定细采样，并随密度衰减
    float creaseDepth, creaseNormal;
    vec3 creaseNearest;
    sampleEdges(vUv, uThickness, creaseDepth, creaseNormal, creaseNearest);

    float silhouette = silhouetteDepth * mix(1.0, 0.55, density);
    float crease = max(creaseNormal * uCreaseOpacity, creaseDepth * 0.35) * creaseWeight;

    // 线框菲涅尔：全屏阶段视线在视空间恒为 (0,0,1)，掠射面更亮、正视面更淡
    float fresnel = pow(clamp(1.0 - abs(creaseNearest.z), 0.0, 1.0), uEdgeFresnelExponent);
    float fresnelFactor = mix(1.0, fresnel, uEdgeFresnelInfluence);

    // 内框折痕与外壳剪影分开上色，先画内部再压外框
    float creaseAlpha = crease * uEdgeOpacity * fresnelFactor;
    float silhouetteAlpha = silhouette * uEdgeOpacity * fresnelFactor;

    #ifdef EDGE_MASK
      // 掩码通道：R=折痕透明度，G=剪影透明度，供光晕与最终合成使用
      gl_FragColor = vec4(creaseAlpha, silhouetteAlpha, 0.0, 1.0);
    #else
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 color = base.rgb + texture2D(tGlow, vUv).rgb * uGlowStrength;
      color = mix(color, uEdgeColorInner * uEdgeIntensityInner, creaseAlpha);
      color = mix(color, uEdgeColor * uEdgeIntensity, silhouetteAlpha);
      gl_FragColor = vec4(color, base.a);
    #endif
  }
`;

// 描边光晕：横向卷积把掩码转成颜色（降到半分辨率），纵向再做一次模糊
const glowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowConvertShader = /* glsl */ `
  uniform sampler2D tMask;
  uniform vec2 uMaskTexel;
  uniform vec3 uInnerColor;
  uniform vec3 uOuterColor;
  uniform float uInnerIntensity;
  uniform float uOuterIntensity;
  uniform float uGlowRadius;
  varying vec2 vUv;

  vec2 sampleMask(vec2 uv) {
    return texture2D(tMask, uv).rg;
  }

  void main() {
    // 只有各层亮度超过 1 的那部分能量才外溢成光晕
    float overInner = max(uInnerIntensity - 1.0, 0.0);
    float overOuter = max(uOuterIntensity - 1.0, 0.0);
    vec2 s = vec2(uMaskTexel.x * uGlowRadius, 0.0);
    vec2 acc = sampleMask(vUv) * 0.227;
    acc += (sampleMask(vUv + s) + sampleMask(vUv - s)) * 0.194;
    acc += (sampleMask(vUv + 2.0 * s) + sampleMask(vUv - 2.0 * s)) * 0.121;
    acc += (sampleMask(vUv + 3.0 * s) + sampleMask(vUv - 3.0 * s)) * 0.054;
    acc += (sampleMask(vUv + 4.0 * s) + sampleMask(vUv - 4.0 * s)) * 0.016;
    vec3 color = uInnerColor * (acc.x * overInner) + uOuterColor * (acc.y * overOuter);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const glowBlurShader = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  uniform float uGlowRadius;
  varying vec2 vUv;

  void main() {
    // 半分辨率下用 0.5 倍半径，保证与横向卷积的像素距离一致
    vec2 s = vec2(0.0, uTexel.y * uGlowRadius * 0.5);
    vec3 acc = texture2D(tInput, vUv).rgb * 0.227;
    acc += (texture2D(tInput, vUv + s).rgb + texture2D(tInput, vUv - s).rgb) * 0.194;
    acc += (texture2D(tInput, vUv + 2.0 * s).rgb + texture2D(tInput, vUv - 2.0 * s).rgb) * 0.121;
    acc += (texture2D(tInput, vUv + 3.0 * s).rgb + texture2D(tInput, vUv - 3.0 * s).rgb) * 0.054;
    acc += (texture2D(tInput, vUv + 4.0 * s).rgb + texture2D(tInput, vUv - 4.0 * s).rgb) * 0.016;
    gl_FragColor = vec4(acc, 1.0);
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

    // 描边掩码：R=折痕透明度，G=剪影透明度；供最终合成与光晕共用，避免重复求边
    this.edgeMaskRT = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    const halfW = Math.max(1, Math.round(width * 0.5));
    const halfH = Math.max(1, Math.round(height * 0.5));
    this.glowHRT = new THREE.WebGLRenderTarget(halfW, halfH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    this.glowRT = new THREE.WebGLRenderTarget(halfW, halfH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });

    // 掩码与合成共用同一批参数 uniform（对象引用共享），GUI 改一处即可同步
    // 注意不要把 tEdgeMask 放进掩码材质，否则渲染到同一张 RT 会形成采样回环
    this.uniforms = {
      tNormal: { value: this.normalRenderTarget.texture },
      tDepth: { value: this.normalRenderTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uThickness: { value: params.edgeThickness },
      uDepthDiff: { value: params.edgeDepthDiff },
      uNormalDiff: { value: params.edgeNormalDiff },
      uEdgeColor: { value: new THREE.Color(params.edgeColor) },
      uEdgeColorInner: { value: new THREE.Color(params.edgeColorInner) },
      uEdgeIntensity: { value: params.edgeIntensity },
      uEdgeIntensityInner: { value: params.edgeIntensityInner },
      uEdgeOpacity: { value: params.edgeOpacity },
      uEdgeFresnelExponent: { value: params.edgeFresnelExponent },
      uEdgeFresnelInfluence: { value: params.edgeFresnelInfluence },
      uSilhouetteScale: { value: params.edgeSilhouetteWidth },
      uCreaseOpacity: { value: params.edgeCreaseOpacity },
      uDetailFade: { value: params.edgeDetailFade },
      uGlowStrength: { value: params.edgeGlowStrength },
    };

    this.compositeUniforms = Object.assign({}, this.uniforms, {
      tDiffuse: { value: null },
      tEdgeMask: { value: this.edgeMaskRT.texture },
      tGlow: { value: this.glowRT.texture },
    });

    // 掩码通道：只求边、不上色
    this.maskMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      defines: { EDGE_MASK: 1 },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    // 合成通道：底图 + 光晕 + 锐利线芯
    this.material = new THREE.ShaderMaterial({
      uniforms: this.compositeUniforms,
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    // 光晕半径：两个材质共用一份，避免 GUI 两处同步
    this.glowRadiusUniform = { value: params.edgeGlowRadius };

    // 光晕第一段：横向卷积，掩码 → 彩色，同时降到半分辨率
    this.glowConvertMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tMask: { value: this.edgeMaskRT.texture },
        uMaskTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        uInnerColor: this.uniforms.uEdgeColorInner,
        uOuterColor: this.uniforms.uEdgeColor,
        uInnerIntensity: this.uniforms.uEdgeIntensityInner,
        uOuterIntensity: this.uniforms.uEdgeIntensity,
        uGlowRadius: this.glowRadiusUniform,
      },
      vertexShader: glowVertexShader,
      fragmentShader: glowConvertShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    // 光晕第二段：纵向模糊
    this.glowBlurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: this.glowHRT.texture },
        uTexel: { value: new THREE.Vector2(1 / halfW, 1 / halfH) },
        uGlowRadius: this.glowRadiusUniform,
      },
      vertexShader: glowVertexShader,
      fragmentShader: glowBlurShader,
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
    this.edgeMaskRT.setSize(width, height);
    const halfW = Math.max(1, Math.round(width * 0.5));
    const halfH = Math.max(1, Math.round(height * 0.5));
    this.glowHRT.setSize(halfW, halfH);
    this.glowRT.setSize(halfW, halfH);
    this.uniforms.uResolution.value.set(width, height);
    this.glowConvertMaterial.uniforms.uMaskTexel.value.set(1 / width, 1 / height);
    this.glowBlurMaterial.uniforms.uTexel.value.set(1 / halfW, 1 / halfH);
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
    // 场景背景是 Color 时 WebGLBackground 会 forceClear，用背景色覆盖法线通道的清屏色；
    // 临时置空背景，保证法线/深度背景恒为中性，不随背景色变化
    const savedBackground = this.scene.background;
    this.scene.background = null;

    renderer.setRenderTarget(this.normalRenderTarget);
    renderer.autoClear = false;
    renderer.setClearColor(0x7777ff, 1.0);
    renderer.clear();

    const changedMats = this._forceMaterialVisible(true);
    this.scene.overrideMaterial = this.normalMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    changedMats.forEach((m) => { m.visible = false; });
    this.scene.background = savedBackground;

    renderer.autoClear = savedAutoClear;
    renderer.setClearColor(this._clearColor, savedClearAlpha);
    this.camera.layers.mask = savedLayerMask;

    // ② 描边掩码：同一份法线/深度只求一次边，输出折痕/剪影透明度
    renderer.setRenderTarget(this.edgeMaskRT);
    this.fsQuad.material = this.maskMaterial;
    this.fsQuad.render(renderer);

    // ③ 光晕横向卷积（掩码 → 彩色，降到半分辨率）
    renderer.setRenderTarget(this.glowHRT);
    this.fsQuad.material = this.glowConvertMaterial;
    this.fsQuad.render(renderer);

    // ④ 光晕纵向模糊
    renderer.setRenderTarget(this.glowRT);
    this.fsQuad.material = this.glowBlurMaterial;
    this.fsQuad.render(renderer);

    // ⑤ 合成：底图 + 光晕，再用锐利线芯覆盖
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.fsQuad.material = this.material;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.normalRenderTarget.dispose();
    this.edgeMaskRT.dispose();
    this.glowHRT.dispose();
    this.glowRT.dispose();
    this.normalMaterial.dispose();
    this.maskMaterial.dispose();
    this.material.dispose();
    this.glowConvertMaterial.dispose();
    this.glowBlurMaterial.dispose();
    this.fsQuad.dispose();
  }
}

// ===== 背景板：让背景层级落到柜体之下 =====
// 原理：不再用 scene.background 清屏，而是每帧先只把柜体剪影写进深度，
// 再用一块贴到远裁剪面的全屏背景板在“没有柜体深度”的像素着色。
// 这样即使柜体材质透明度远小于 1，背景也不会透过柜体，剪影内部只留深色底色。
// 背景板画完后立即清空深度，后续场景渲染仍保持原有的透明叠加关系。
const BACKDROP_INTERIOR_COLOR = 0x06090f;

class BackdropPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;

    // 只写深度、不写颜色，用于生成柜体剪影
    this.depthMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
    });

    // 背景板：贴在远裁剪面，配合 LessEqual 只通过未写入柜体深度的像素
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uBgColor: { value: new THREE.Color(params.bgColor) },
      },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uBgColor;
        void main() {
          gl_FragColor = vec4(uBgColor, 1.0);
        }
      `,
      depthTest: true,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
      blending: THREE.NoBlending,
    });
    this.fsQuad = new FullScreenQuad(this.material);

    this._clearColor = new THREE.Color();
    this._outlineLayers = new THREE.Layers();
    this._outlineLayers.set(1);
  }

  // 线框模式会把实体材质的 visible 设为 false，剪影通道需要模型照常参与，临时打开再还原
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
    const savedAutoClear = renderer.autoClear;
    renderer.getClearColor(this._clearColor);
    const savedClearAlpha = renderer.getClearAlpha();
    const savedBackground = this.scene.background;
    this.scene.background = null;

    // ① 清屏：颜色 = 柜体内部底色，深度 = 远裁剪面
    renderer.setRenderTarget(readBuffer);
    renderer.autoClear = false;
    renderer.setClearColor(BACKDROP_INTERIOR_COLOR, 1.0);
    renderer.clear();

    // ② 柜体剪影写深度（相机临时只启用第 1 层）
    const savedLayerMask = this.camera.layers.mask;
    this.camera.layers.set(1);
    const changedMats = this._forceMaterialVisible(true);
    this.scene.overrideMaterial = this.depthMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    changedMats.forEach((m) => { m.visible = false; });
    this.camera.layers.mask = savedLayerMask;

    // ③ 背景板：剪影处被深度测试拒绝，背景不会覆盖柜体
    this.fsQuad.render(renderer);

    // ④ 清掉深度，后续场景渲染不受剪影深度影响
    renderer.clearDepth();

    renderer.autoClear = savedAutoClear;
    renderer.setClearColor(this._clearColor, savedClearAlpha);
    this.scene.background = savedBackground;
  }

  dispose() {
    this.depthMaterial.dispose();
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

// ===== 按原始材质合并网格 =====
// GLTFLoader 会把每个 primitive 拆成独立 Mesh（本模型 77 个节点 / 141 个 primitive），
// 统一替换成全息材质后逐块绘制没有意义。这里把同一原始材质的网格连同节点矩阵烘焙后
// 合并，模型 draw call 从 141 降到 17；同时记录每段三角形对应的设备名称，后续点击
// 拾取可用 faceIndex 反查，复用的同类零件也各自保留独立区间。
const mergeModelByMaterial = (model) => {
  model.updateWorldMatrix(true, true);
  const inverseRoot = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const matrix = new THREE.Matrix4();

  const meshNodes = [];
  model.traverse((child) => {
    if (child.isMesh && child.geometry) meshNodes.push(child);
  });

  // 设备名挂在节点上；多 primitive 时 Mesh 名是网格名，需要向上找节点名
  const resolveDeviceName = (object) => {
    let node = object;
    while (node && node !== model) {
      if (node.userData && node.userData.name) return node.userData.name;
      node = node.parent;
    }
    return object.name || '未命名设备';
  };

  const groups = new Map();
  meshNodes.forEach((child) => {
    // 多材质网格不参与合并，保持原样
    if (!child.material || Array.isArray(child.material)) return;

    const geometry = child.geometry.clone();
    matrix.multiplyMatrices(inverseRoot, child.matrixWorld);
    geometry.applyMatrix4(matrix);

    let group = groups.get(child.material);
    if (!group) {
      group = { material: child.material, geometries: [], names: [] };
      groups.set(child.material, group);
    }
    group.geometries.push(geometry);
    group.names.push(resolveDeviceName(child));
  });

  const mergedGroup = new THREE.Group();
  mergedGroup.name = '柜体合并网格';

  groups.forEach(({ material, geometries, names }) => {
    // 合并前记录每个原网格占用的三角面区间，供点击拾取反查设备
    const parts = [];
    let start = 0;
    geometries.forEach((geometry, index) => {
      const count = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      parts.push({ name: names[index], start, count });
      start += count;
    });

    const merged = mergeGeometries(geometries, false);

    if (!merged) {
      // 合并失败时退化为逐块网格，避免丢失部件
      geometries.forEach((geometry, index) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.layers.enable(1);
        mesh.userData.parts = [parts[index]];
        mergedGroup.add(mesh);
      });
      return;
    }

    geometries.forEach((geometry) => geometry.dispose());
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    const mesh = new THREE.Mesh(merged, material);
    mesh.name = material.name || 'merged';
    mesh.layers.enable(1);
    mesh.userData.parts = parts;
    mergedGroup.add(mesh);
  });

  // 移除原网格节点并释放几何（原始材质继续给合并网格使用）
  const disposedGeometries = new Set();
  meshNodes.forEach((child) => {
    if (!child.material || Array.isArray(child.material)) return;
    if (child.parent) child.parent.remove(child);
    if (!disposedGeometries.has(child.geometry)) {
      child.geometry.dispose();
      disposedGeometries.add(child.geometry);
    }
  });

  model.add(mergedGroup);
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

        // 合并会改变网格结构，先按原始模型统计几何数据（信息面板展示用）
        geometryStats = computeGeometryStats(model);

        // 按原始材质合并网格，降低 draw call
        mergeModelByMaterial(model);

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

// ===== 柜体几何数据面板 =====
const formatStatNumber = (value) => Number(value || 0).toLocaleString('en-US');

// 统计单块几何体的唯一无向边数量
const countGeometryEdges = (geometry) => {
  const position = geometry.attributes.position;
  if (!position) return 0;

  const index = geometry.index;
  const edgeKeys = new Set();
  const stride = Math.max(position.count, 1);
  const addEdge = (a, b) => {
    edgeKeys.add(a < b ? a * stride + b : b * stride + a);
  };

  if (index) {
    const array = index.array;
    for (let i = 0; i < array.length; i += 3) {
      addEdge(array[i], array[i + 1]);
      addEdge(array[i + 1], array[i + 2]);
      addEdge(array[i + 2], array[i]);
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i + 2, i);
    }
  }

  return edgeKeys.size;
};

// 统计柜体整体数据（顶点 / 三角面 / 边 / 网格 / 几何体 / 材质 / 尺寸）
const computeGeometryStats = (model) => {
  const stats = {
    vertices: 0,
    triangles: 0,
    edges: 0,
    meshes: 0,
    geometries: 0,
    materials: 0,
    size: new THREE.Vector3(),
  };
  if (!model) return stats;

  const geometrySet = new Set();
  const materialSet = new Set();
  const edgeCache = new Map();

  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geometry = child.geometry;
    const position = geometry.attributes.position;
    if (!position) return;

    stats.meshes += 1;
    stats.vertices += position.count;
    stats.triangles += geometry.index ? geometry.index.count / 3 : position.count / 3;

    let edges = edgeCache.get(geometry.uuid);
    if (edges === undefined) {
      edges = countGeometryEdges(geometry);
      edgeCache.set(geometry.uuid, edges);
    }
    stats.edges += edges;

    geometrySet.add(geometry.uuid);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material) materialSet.add(material.uuid);
    });
  });

  const box = new THREE.Box3().setFromObject(model);
  box.getSize(stats.size);
  stats.geometries = geometrySet.size;
  stats.materials = materialSet.size;
  return stats;
};

// 模型加载完成后提前统计，避免首次点击卡顿
const scheduleGeometryStats = (model) => {
  // 加载阶段已按原始模型统计过，避免被合并后的网格结构覆盖
  if (geometryStats) return;
  const compute = () => {
    geometryStatsIdle = null;
    if (model === turbineGroup) geometryStats = computeGeometryStats(model);
  };
  if ('requestIdleCallback' in window) {
    geometryStatsIdle = requestIdleCallback(compute, { timeout: 3000 });
  } else {
    geometryStatsIdle = setTimeout(compute, 0);
  }
};

const cancelGeometryStats = () => {
  if (geometryStatsIdle === null) return;
  if ('requestIdleCallback' in window) cancelIdleCallback(geometryStatsIdle);
  else clearTimeout(geometryStatsIdle);
  geometryStatsIdle = null;
};

// 绘制面板纹理内容
const drawGeometryPanel = (stats) => {
  if (!geometryPanelTexture) return;
  const panelCanvas = geometryPanelTexture.image;
  const ctx = panelCanvas.getContext('2d');
  const width = panelCanvas.width;
  const height = panelCanvas.height;

  ctx.clearRect(0, 0, width, height);

  // 背景与切角边框（45° 切角八边形）
  const panelMargin = 10;
  const chamfer = 28;
  const panelRight = width - panelMargin;
  const panelBottom = height - panelMargin;
  ctx.beginPath();
  ctx.moveTo(panelMargin + chamfer, panelMargin);
  ctx.lineTo(panelRight - chamfer, panelMargin);
  ctx.lineTo(panelRight, panelMargin + chamfer);
  ctx.lineTo(panelRight, panelBottom - chamfer);
  ctx.lineTo(panelRight - chamfer, panelBottom);
  ctx.lineTo(panelMargin + chamfer, panelBottom);
  ctx.lineTo(panelMargin, panelBottom - chamfer);
  ctx.lineTo(panelMargin, panelMargin + chamfer);
  ctx.closePath();
  ctx.fillStyle = 'rgba(4, 12, 22, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 四角高亮：与外框切角同角度、同位置的加粗斜线
  const accentInset = 5;
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.95)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  [
    [panelMargin + chamfer - accentInset, panelMargin + accentInset, panelMargin + accentInset, panelMargin + chamfer - accentInset],
    [panelRight - chamfer + accentInset, panelMargin + accentInset, panelRight - accentInset, panelMargin + chamfer - accentInset],
    [panelRight - accentInset, panelBottom - chamfer + accentInset, panelRight - chamfer + accentInset, panelBottom - accentInset],
    [panelMargin + accentInset, panelBottom - chamfer + accentInset, panelMargin + chamfer - accentInset, panelBottom - accentInset],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.lineCap = 'butt';

  // 标题
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4fc3f7';
  ctx.font = 'bold 36px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.fillText('几何数据', 56, 84);

  ctx.fillStyle = 'rgba(120, 200, 230, 0.75)';
  ctx.font = '20px Consolas, "Courier New", monospace';
  ctx.fillText('GEOMETRY DATA', 58, 116);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(160, 220, 245, 0.7)';
  ctx.font = '20px "Microsoft YaHei", sans-serif';
  ctx.fillText('1号直流变电柜', width - 56, 100);

  // 分隔线
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, 140);
  ctx.lineTo(width - 56, 140);
  ctx.stroke();

  // 数据行
  const rows = [
    ['顶点', 'VERTICES', formatStatNumber(stats.vertices)],
    ['三角面', 'TRIANGLES', formatStatNumber(stats.triangles)],
    ['边', 'EDGES', formatStatNumber(stats.edges)],
    ['网格', 'MESHES', formatStatNumber(stats.meshes)],
    ['几何体', 'GEOMETRIES', formatStatNumber(stats.geometries)],
    ['材质', 'MATERIALS', formatStatNumber(stats.materials)],
    ['尺寸', 'SIZE', `${stats.size.x.toFixed(2)} × ${stats.size.y.toFixed(2)} × ${stats.size.z.toFixed(2)}`],
  ];
  rows.forEach(([label, english, value], rowIndex) => {
    const y = 182 + rowIndex * 52;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 235, 245, 0.85)';
    ctx.font = '24px "Microsoft YaHei", "Noto Sans SC", sans-serif';
    ctx.fillText(label, 56, y);

    ctx.fillStyle = 'rgba(110, 175, 200, 0.55)';
    ctx.font = '15px Consolas, "Courier New", monospace';
    ctx.fillText(english, 138, y - 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e6faff';
    ctx.font = 'bold 28px Consolas, "Courier New", monospace';
    ctx.fillText(value, width - 56, y);

    ctx.strokeStyle = 'rgba(79, 195, 247, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(56, y + 18);
    ctx.lineTo(width - 56, y + 18);
    ctx.stroke();
  });

  // 底部说明
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(120, 190, 215, 0.6)';
  ctx.font = '17px "Microsoft YaHei", sans-serif';
  ctx.fillText('数据按 GPU 缓冲统计 · 点击空白处关闭', 56, height - 34);

  geometryPanelTexture.needsUpdate = true;
};

// 计算模型局部坐标下的包围盒
const computeModelLocalBounds = (model) => {
  const box = new THREE.Box3();
  if (!model) return box;

  const meshBox = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  model.updateWorldMatrix(true, true);
  const inverseRoot = new THREE.Matrix4().copy(model.matrixWorld).invert();

  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    matrix.multiplyMatrices(inverseRoot, child.matrixWorld);
    meshBox.copy(child.geometry.boundingBox).applyMatrix4(matrix);
    box.union(meshBox);
  });

  return box;
};

// 按模型当前矩阵更新面板的世界位置与朝向（局部 +Z 位置、局部 +X 朝向）
const applyGeometryPanelTransform = () => {
  if (!geometryPanelGroup || !turbineGroup) return;

  geometryPanelGroup.position.copy(geometryPanelLocalPosition).applyMatrix4(turbineGroup.matrixWorld);
  geometryPanelGroup.quaternion
    .copy(turbineGroup.getWorldQuaternion(geometryPanelWorldQuaternion))
    .multiply(geometryPanelLocalQuaternion);
};

// 创建面板（懒加载，只创建一次）
const ensureGeometryPanel = () => {
  if (geometryPanelGroup) return;

  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 1024;
  panelCanvas.height = 640;

  geometryPanelTexture = new THREE.CanvasTexture(panelCanvas);
  // 后期合成没有 OutputPass，按原样输出 Canvas 颜色，避免面板偏暗
  geometryPanelTexture.colorSpace = THREE.NoColorSpace;
  geometryPanelTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  geometryPanelTexture.minFilter = THREE.LinearMipmapLinearFilter;
  geometryPanelTexture.magFilter = THREE.LinearFilter;

  geometryPanelMaterial = new THREE.MeshBasicMaterial({
    map: geometryPanelTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  geometryPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06), geometryPanelMaterial);
  geometryPanelMesh.renderOrder = 8;

  geometryPanelGroup = new THREE.Group();
  geometryPanelGroup.add(geometryPanelMesh);

  // 锚点定位在模型局部 -Z 一侧，正面朝向局部 +X，模型旋转时跟随
  const localBox = computeModelLocalBounds(turbineGroup);
  const localCenter = localBox.getCenter(new THREE.Vector3());
  const worldScale = turbineGroup.getWorldScale(new THREE.Vector3());
  const scaleY = Math.abs(worldScale.y) || 1;
  const scaleZ = Math.abs(worldScale.z) || 1;
  const panelHalfWidth = 1.7 / 2;
  const panelGap = 0.2;
  geometryPanelLocalPosition.set(
    localCenter.x,
    localCenter.y + 0.2 / scaleY,
    localBox.min.z - (panelHalfWidth + panelGap) / scaleZ
  );
  geometryPanelLocalQuaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  applyGeometryPanelTransform();

  geometryPanelGroup.visible = false;
  scene.add(geometryPanelGroup);
};

const showGeometryPanel = () => {
  if (!turbineGroup || !scene) return;
  if (!geometryStats) geometryStats = computeGeometryStats(turbineGroup);
  ensureGeometryPanel();
  drawGeometryPanel(geometryStats);
  geometryPanelGroup.visible = true;
};

const hideGeometryPanel = () => {
  if (geometryPanelGroup) geometryPanelGroup.visible = false;
};

const disposeGeometryPanel = () => {
  cancelGeometryStats();
  if (geometryPanelGroup && scene) scene.remove(geometryPanelGroup);
  if (geometryPanelMesh) {
    geometryPanelMesh.geometry.dispose();
    geometryPanelMesh = null;
  }
  if (geometryPanelMaterial) {
    geometryPanelMaterial.dispose();
    geometryPanelMaterial = null;
  }
  if (geometryPanelTexture) {
    geometryPanelTexture.dispose();
    geometryPanelTexture = null;
  }
  geometryPanelGroup = null;
  geometryStats = null;
};

// 点击柜体显示面板，点击空白关闭；拖动不算点击
const handleGeometryPointerDown = (event) => {
  pendingPointer = { x: event.clientX, y: event.clientY };
};

const handleGeometryPointerUp = (event) => {
  if (!pendingPointer) return;
  const dx = event.clientX - pendingPointer.x;
  const dy = event.clientY - pendingPointer.y;
  pendingPointer = null;
  if (Math.hypot(dx, dy) > 6) return;
  if (!camera || !turbineGroup || !renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  geometryPointerNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  geometryRaycaster.setFromCamera(geometryPointerNdc, camera);

  const cabinetHit = geometryRaycaster.intersectObject(turbineGroup, true)[0];
  const panelHit =
    geometryPanelGroup && geometryPanelGroup.visible
      ? geometryRaycaster.intersectObject(geometryPanelGroup, true)[0]
      : null;

  if (cabinetHit && (!panelHit || cabinetHit.distance < panelHit.distance)) {
    showGeometryPanel();
    return;
  }

  if (panelHit) return;

  hideGeometryPanel();
};

// ===== 视觉效果开关处理函数 =====
const toggleBloom = (val) => {
  if (bloomPass) bloomPass.enabled = val;
};

const toggleParticles = (val) => {
  if (particles) particles.visible = val;
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
  const blend = getShellBlending(val);
  updateFresnelMaterials((m) => {
    Object.assign(m, blend);
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
  if (backdropPass) backdropPass.material.uniforms.uBgColor.value.set(val);
};

const updateFogDensity = (val) => {
  if (originalFog) originalFog.density = val;
};

// ===== 左上角性能面板：帧率历史曲线 =====
const drawFpsHistory = () => {
  const cv = fpsChartRef.value;
  if (!cv) return;
  const width = cv.clientWidth;
  const height = cv.clientHeight;
  if (!width || !height) return;

  // 按设备像素比放大画布，保证曲线清晰
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(width * dpr) || cv.height !== Math.round(height * dpr)) {
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // 参考网格
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.14)';
  ctx.lineWidth = 1;
  [0.5, 1].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(0, height * k);
    ctx.lineTo(width, height * k);
    ctx.stroke();
  });

  const samples = fpsHistory;
  if (samples.length === 0) return;

  const maxFps = Math.max(60, ...samples);
  const stepX = width / (FPS_HISTORY_SIZE - 1);
  const offsetX = width - (samples.length - 1) * stepX;
  const pointAt = (i) => [
    offsetX + i * stepX,
    height - (Math.min(samples[i], maxFps) / maxFps) * height,
  ];

  // 曲线下方渐变填充
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(79, 195, 247, 0.3)');
  gradient.addColorStop(1, 'rgba(79, 195, 247, 0)');
  ctx.beginPath();
  ctx.moveTo(offsetX, height);
  samples.forEach((_, i) => {
    const [x, y] = pointAt(i);
    ctx.lineTo(x, y);
  });
  ctx.lineTo(offsetX + (samples.length - 1) * stepX, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // 折线
  ctx.beginPath();
  samples.forEach((_, i) => {
    const [x, y] = pointAt(i);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
};

// 每帧调用：累计帧数，按固定间隔更新面板数值与曲线
const updatePerfPanel = () => {
  perfFrameCount += 1;
  const now = performance.now();
  if (perfSampleStart === 0) perfSampleStart = now;
  const elapsed = now - perfSampleStart;
  if (elapsed < FPS_SAMPLE_INTERVAL) return;

  const fps = Math.round((perfFrameCount * 1000) / elapsed);
  perfFrameCount = 0;
  perfSampleStart = now;

  if (fpsValueRef.value) fpsValueRef.value.textContent = String(fps);
  if (drawCallsValueRef.value) drawCallsValueRef.value.textContent = String(perfDrawCalls);

  fpsHistory.push(fps);
  if (fpsHistory.length > FPS_HISTORY_SIZE) fpsHistory.shift();
  drawFpsHistory();
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
  fToggle.add(params, 'labels').name('文字标注').onChange(toggleLabels);
  fToggle.add(params, 'fog').name('场景雾效').onChange(toggleFog);

  // —— 模型材质 ——
  const fMat = gui.addFolder('模型材质');
  fMat.addColor(params, 'shellColor').name('外壳颜色').onChange(updateShellColor);
  fMat.add(params, 'fresnelOpacity', 0, 1, 0.01).name('Fresnel 透明度').onChange(updateFresnelOpacity);
  fMat.add(params, 'fresnelExponent', 0.5, 8, 0.1).name('Fresnel 指数').onChange(updateFresnelExponent);
  fMat.add(params, 'centerColorFactor', 0, 1, 0.01).name('中心亮度系数').onChange(updateCenterColorFactor);
  fMat.add(params, 'centerAlphaFactor', 0, 1, 0.01).name('中心透明度系数').onChange(updateCenterAlphaFactor);
  fMat.add(params, 'blending', { Screen: 'Screen', Additive: 'Additive', Normal: 'Normal' }).name('混合模式').onChange(updateBlending);
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
  fEdge.add(params, 'edgeSilhouetteWidth', 1, 6, 0.1).name('剪影宽度(倍率)').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uSilhouetteScale.value = v;
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
  fEdge.add(params, 'edgeIntensity', 0.2, 4, 0.05).name('外框亮度').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeIntensity.value = v;
  });
  fEdge.add(params, 'edgeIntensityInner', 0.2, 4, 0.05).name('内框亮度').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeIntensityInner.value = v;
  });
  fEdge.add(params, 'edgeGlowStrength', 0, 3, 0.05).name('光晕强度').onChange((v) => {
    if (outlinePass) outlinePass.uniforms.uGlowStrength.value = v;
  });
  fEdge.add(params, 'edgeGlowRadius', 1, 10, 0.5).name('光晕半径').onChange((v) => {
    if (outlinePass) outlinePass.glowRadiusUniform.value = v;
  });
  fEdge.add(params, 'edgeCreaseOpacity', 0, 1, 0.01).name('折痕不透明度').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uCreaseOpacity.value = v;
  });
  fEdge.add(params, 'edgeDetailFade', 0, 1, 0.01).name('细节抑制').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uDetailFade.value = v;
  });
  fEdge.add(params, 'edgeFresnelExponent', 0.5, 8, 0.1).name('线框菲涅尔指数').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeFresnelExponent.value = v;
  });
  fEdge.add(params, 'edgeFresnelInfluence', 0, 1, 0.01).name('线框菲涅尔强度').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeFresnelInfluence.value = v;
  });
  fEdge.addColor(params, 'edgeColor').name('外框描边颜色').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeColor.value.set(v);
  });
  fEdge.addColor(params, 'edgeColorInner').name('内框描边颜色').onChange((v) => {
    if (outlinePass) outlinePass.material.uniforms.uEdgeColorInner.value.set(v);
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
  // 背景交给 BackdropPass 的背景板绘制，背景因此可以被柜体剪影遮挡
  scene.background = null;
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
  // 手动重置渲染统计，累计一帧内所有后处理通道的 Draw Call
  renderer.info.autoReset = false;
  // 默认色调映射与 params 一致
  updateToneMapping(params.toneMapping);

  bindRenderer(renderer, camera);

  // ===== 柜体点击拾取：几何数据面板 =====
  canvas.addEventListener('pointerdown', handleGeometryPointerDown);
  canvas.addEventListener('pointerup', handleGeometryPointerUp);

  // ===== 后期处理：背景板 → RenderPass → Bloom → 轮廓描边 =====
  // 背景板先画且被柜体剪影遮挡；描边放在 Bloom 之后，避免细线被泛光膨胀糊在一起
  composer = new EffectComposer(renderer);
  backdropPass = new BackdropPass(scene, camera);
  composer.addPass(backdropPass);
  const renderPass = new RenderPass(scene, camera);
  // 背景与深度已由 BackdropPass 处理，这里不能重复清屏
  renderPass.clear = false;
  composer.addPass(renderPass);
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(elementSize.value.width, elementSize.value.height),
    params.bloomStrength,
    params.bloomRadius,
    params.bloomThreshold
  );
  composer.addPass(bloomPass);
  outlinePass = new OutlineEdgePass(scene, camera, elementSize.value.width, elementSize.value.height);
  composer.addPass(outlinePass);

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
      // 预统计几何数据，供点击时直接展示
      scheduleGeometryStats(model);
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

    // 面板跟随模型的旋转与位移
    if (turbineGroup) {
      turbineGroup.updateWorldMatrix(true, false);
      applyGeometryPanelTransform();
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
    // 累计本帧所有后处理通道的渲染统计
    renderer.info.reset();
    composer.render();
    perfDrawCalls = renderer.info.render.calls;
    labelRenderer.render(scene, camera);
    updatePerfPanel();
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

  // 清理柜体点击事件与几何数据面板
  if (canvas) {
    canvas.removeEventListener('pointerdown', handleGeometryPointerDown);
    canvas.removeEventListener('pointerup', handleGeometryPointerUp);
  }
  pendingPointer = null;
  disposeGeometryPanel();

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
  if (backdropPass) {
    backdropPass.dispose();
    backdropPass = null;
  }
  outlinePass = null;
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

/* ===== 左上角性能面板（样式参考几何数据面板） ===== */
.perf-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  width: 232px;
  padding: 1px;
  /* 外层作为 1px 切角描边 */
  background: rgba(79, 195, 247, 0.75);
  clip-path: polygon(
    15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px),
    calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px
  );
  pointer-events: none;
  font-family: "Microsoft YaHei", "Noto Sans SC", sans-serif;
}
.perf-panel__inner {
  position: relative;
  padding: 14px 16px 12px;
  background: rgba(4, 12, 22, 0.92);
  clip-path: polygon(
    14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px),
    calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px
  );
}
/* 四角高亮斜线 */
.perf-accent {
  position: absolute;
  width: 12px;
  height: 4px;
  border-radius: 2px;
  background: rgba(79, 195, 247, 0.95);
}
.perf-accent--tl { top: 5px; left: 1px; transform: rotate(-45deg); }
.perf-accent--tr { top: 5px; right: 1px; transform: rotate(45deg); }
.perf-accent--br { bottom: 5px; right: 1px; transform: rotate(-45deg); }
.perf-accent--bl { bottom: 5px; left: 1px; transform: rotate(45deg); }

.perf-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.perf-title {
  color: #4fc3f7;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 2px;
}
.perf-subtitle {
  color: rgba(120, 200, 230, 0.75);
  font: 10px/1 Consolas, "Courier New", monospace;
  letter-spacing: 1px;
}
.perf-divider {
  height: 1px;
  margin: 10px 0 2px;
  background: rgba(79, 195, 247, 0.35);
}

.perf-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 9px 0 8px;
  border-bottom: 1px solid rgba(79, 195, 247, 0.1);
}
.perf-label {
  color: rgba(200, 235, 245, 0.85);
  font-size: 13px;
}
.perf-label em {
  margin-left: 6px;
  color: rgba(110, 175, 200, 0.55);
  font: 9px/1 Consolas, "Courier New", monospace;
  font-style: normal;
  letter-spacing: 0.5px;
}
.perf-value {
  color: #e6faff;
  font: 700 16px/1 Consolas, "Courier New", monospace;
  text-shadow: 0 0 8px rgba(79, 195, 247, 0.45);
}

.perf-chart-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0 6px;
  color: rgba(200, 235, 245, 0.85);
  font-size: 13px;
}
.perf-chart-label em {
  color: rgba(110, 175, 200, 0.55);
  font: 9px/1 Consolas, "Courier New", monospace;
  font-style: normal;
}
.perf-chart {
  display: block;
  width: 100%;
  height: 46px;
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
