<template>
  <div class="three-container">
    <canvas ref="canvasRef" class="webgl_11"></canvas>

    <!-- 外观切换（柔光棚 / 科技蓝） -->
    <div class="look-switch" role="group" aria-label="外观切换">
      <button
        class="look-btn"
        :class="{ active: lookName === 'studio' }"
        type="button"
        @click="switchLook('studio')"
      >
        柔光棚
      </button>
      <button
        class="look-btn"
        :class="{ active: lookName === 'tech' }"
        type="button"
        @click="switchLook('tech')"
      >
        科技蓝
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useElementSize } from '../utils/useElementSize';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { beginAssetLoading, endAssetLoading, reportAssetProgress } from '../utils/pageLoading';

/* ============================================================
   柔和摄影棚风格（参考 cassette-main 的布光/后期思路）
   - 浅灰无缝背景穹顶（Canvas 渐变贴图）
   - 五盏 RectAreaLight 柔光箱：主光 / 补光 / 轮廓光 / 反弹光 / 顶光
   - 一盏平行光只负责投软阴影
   - PMREM 环境贴图给 PBR 材质柔和反射
   - SSAO 接触阴影 + 弱 Bloom + 电影调色（暗角/颗粒/分离色调）
   ============================================================ */

const MODEL_URL = 'static/holographicModel/1号直流变电柜.glb';
const FLOOR_Y = -1.45;

// 页面资源进度令牌：setup 阶段即登记，避免路由就绪后遮罩提前收尾
const assetToken = beginAssetLoading();

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let canvas = null;
let animationId = null;
let composer = null;
let ssaoPass = null;
let bloomPass = null;
let gradePass = null;
let pmrem = null;
let envTexture = null;
let modelRoot = null;
let dirShadow = null;
let labelResizeObserver = null;
let gui = null;
// 供调试面板控制的引用
let backdropWarm = null;
let backdropTech = null;
let floorMesh = null;
let shadowCatcher = null;
let lightPool = null;
let hemiLight = null;
// 科技蓝专属元素
let scanRing = null;
let scanCone = null;

// 外观切换（柔光棚 / 科技蓝）
const lookName = ref('studio');
let envTextures = { studio: null, tech: null };

// 需要手动释放的程序化贴图
const textures = [];
// 灯泡引用
const rectLights = {};

const clock = new THREE.Clock();

/* ============================================================
   可调参数（由 lil-gui 绑定，同时作为初始值来源）
   ============================================================ */
const params = {
  // 外观预设
  look: 'studio',
  lookTransition: 0.6,
  fogOn: true,
  scanOn: true,
  // 色调 / 背景
  exposure: 0.8,
  toneMapping: 'Neutral',
  backdropLevel: 1.0,
  // 柔光箱布光
  keyIntensity: 1.75,
  fillIntensity: 1.05,
  rimIntensity: 1.05,
  bounceIntensity: 0.50,
  topIntensity: 0.48,
  shadowOn: true,
  shadowIntensity: 0.5,
  hemiIntensity: 0.26,
  // 环境与材质
  envOn: true,
  envIntensity: 0.6,
  modelEnvIntensity: 0.8,
  roughnessFloor: 0.35,
  // 地面与光池
  floorColor: '#b4b9c0',
  floorRoughness: 0.5,
  shadowOpacity: 0.2,
  poolOpacity: 0.14,
  // 后期处理
  bloomOn: true,
  bloomStrength: 0.22,
  bloomRadius: 0.62,
  bloomThreshold: 0.86,
  ssaoOn: true,
  ssaoRadius: 0.15,
  ssaoMinDistance: 0.0004,
  ssaoMaxDistance: 0.0008,
  aoIntensity: 0.75,
  aoSoftness: 0.35,
  grain: 0.032,
  vignette: 0.45,
  chromatic: 0.5,
  saturation: 1.02,
  halation: 0.02,
  edgeBlur: 0.55,
  focus: 0.34,
  // 相机与动画
  autoRotate: true,
  autoRotateSpeed: 0.28,
  fov: 32,
  // 空气尘埃
  dustOn: true,
  dustSize: 0.055,
  dustOpacity: 0.42,
  dustSpeed: 1.0,
};

// 柔光箱名称 → 参数键
const LIGHT_KEYS = {
  key: 'keyIntensity',
  fill: 'fillIntensity',
  rim: 'rimIntensity',
  bounce: 'bounceIntensity',
  top: 'topIntensity',
};

// 色调映射预设
const TONE_MAPPINGS = {
  Neutral: THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping,
  ACES: THREE.ACESFilmicToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
};

/* ----------------------------- 程序化贴图 ----------------------------- */

// 背景穹顶：竖向渐变 + 柔光斑（studio = 浅灰暖棚，tech = 深蓝暗场）
const createBackdropTexture = (kind = 'studio') => {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (kind === 'tech') {
    g.addColorStop(0.0, '#080c16');
    g.addColorStop(0.35, '#0e1626');
    g.addColorStop(0.62, '#17253c');   // 地平线附近最亮，模拟冷光雾
    g.addColorStop(0.82, '#111b2c');
    g.addColorStop(1.0, '#0a101a');
  } else {
    g.addColorStop(0.0, '#b4b8bf');   // 顶部略深
    g.addColorStop(0.45, '#c2c6cc');
    g.addColorStop(0.75, '#cdd1d6');
    g.addColorStop(1.0, '#d8dbdf');   // 接近地面处最亮
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (kind === 'tech') {
    // 主体后方冷蓝辉光
    const blue = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.52);
    blue.addColorStop(0, 'rgba(58,120,220,0.38)');
    blue.addColorStop(0.5, 'rgba(48,96,180,0.14)');
    blue.addColorStop(1, 'rgba(40,80,150,0)');
    ctx.fillStyle = blue;
    ctx.fillRect(0, 0, w, h);

    // 右侧一抹暖紫，避免整屏单调
    const magenta = ctx.createRadialGradient(w * 0.9, h * 0.3, 0, w * 0.9, h * 0.3, w * 0.32);
    magenta.addColorStop(0, 'rgba(150,70,130,0.20)');
    magenta.addColorStop(1, 'rgba(130,60,120,0)');
    ctx.fillStyle = magenta;
    ctx.fillRect(0, 0, w, h);
  } else {
    // 主体后方一团柔和亮斑
    const spot = ctx.createRadialGradient(w * 0.52, h * 0.66, 0, w * 0.52, h * 0.66, w * 0.5);
    spot.addColorStop(0, 'rgba(255,255,255,0.30)');
    spot.addColorStop(0.55, 'rgba(255,255,255,0.10)');
    spot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.push(tex);
  return tex;
};

// 圆形柔光粒子
const createDustSprite = () => {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,246,232,0.55)');
  g.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.push(tex);
  return tex;
};

// 地面中央的柔光池
const createPoolTexture = () => {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.push(tex);
  return tex;
};

/* ----------------------------- 环境（PMREM） ---------------------------- */

// 用"渐变穹顶 + 自发光柔光板"烘焙环境贴图，让 PBR 材质有柔和长条高光
// kind: 'studio'（暖白棚） | 'tech'（冷蓝暗场）
const buildEnvironment = (kind = 'studio') => {
  const envScene = new THREE.Scene();
  const tech = kind === 'tech';

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(40, 32, 24),
    new THREE.MeshBasicMaterial({
      map: createBackdropTexture(kind),
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  envScene.add(dome);

  // studio：暖白主灯 + 中性补光；tech：冷白主灯 + 蓝色灯条与更强的冷侧光
  const panels = tech
    ? [
        { w: 20, h: 13, c: [2.6, 3.2, 4.2], p: [-7.5, 10.5, 8] },   // 主光（冷白）
        { w: 13, h: 10, c: [1.5, 2.4, 4.0], p: [11, 2.5, 6] },      // 冷蓝补光
        { w: 1.5, h: 30, c: [1.2, 3.0, 5.0], p: [0, 7, -13] },      // 青色轮廓灯条
        { w: 1.2, h: 22, c: [0.8, 2.2, 4.4], p: [-13, 3.5, -1] },   // 左蓝灯条
        { w: 1.2, h: 22, c: [0.9, 2.4, 4.6], p: [13, 3.5, -1] },    // 右蓝灯条
        { w: 22, h: 22, c: [0.9, 1.4, 2.2], p: [0, 14, 0] },        // 顶部冷泛光
        { w: 3.2, h: 3.2, c: [3.4, 4.0, 5.0], p: [-9, 7.5, 9] },    // 冷高光点
        { w: 18, h: 18, c: [0.10, 0.16, 0.28], p: [0, -9, 2] },     // 深蓝地面反弹
      ]
    : [
        { w: 20, h: 13, c: [4.4, 4.2, 4.0], p: [-7.5, 10.5, 8] },   // 主光
        { w: 13, h: 10, c: [1.1, 1.3, 1.7], p: [11, 2.5, 6] },      // 冷补光
        { w: 1.5, h: 30, c: [2.9, 3.1, 4.0], p: [0, 7, -13] },      // 轮廓灯条
        { w: 1.2, h: 22, c: [2.6, 2.4, 2.1], p: [-13, 3.5, -1] },   // 左灯条
        { w: 1.2, h: 22, c: [1.5, 1.8, 2.2], p: [13, 3.5, -1] },    // 右灯条
        { w: 22, h: 22, c: [2.1, 2.1, 2.0], p: [0, 14, 0] },        // 顶部泛光
        { w: 3.2, h: 3.2, c: [4.2, 4.1, 3.9], p: [-9, 7.5, 9] },    // 高光点
        { w: 18, h: 18, c: [0.22, 0.21, 0.20], p: [0, -9, 2] },     // 地面反弹
      ];
  const meshes = panels.map((p) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(p.w, p.h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(p.c[0], p.c[1], p.c[2]),
        side: THREE.DoubleSide,
      })
    );
    m.position.set(p.p[0], p.p[1], p.p[2]);
    m.lookAt(0, 0, 0);
    envScene.add(m);
    return m;
  });

  const texture = pmrem.fromScene(envScene, 0.04).texture;

  dome.geometry.dispose();
  dome.material.dispose();
  meshes.forEach((m) => {
    m.geometry.dispose();
    m.material.dispose();
  });

  return texture;
};

/* ----------------------------- 灯光（柔光箱） --------------------------- */

const createLights = () => {
  RectAreaLightUniformsLib.init();

  // studio 预设：参考 cassette-main/src/lights.js
  const RIG = {
    key: { c: 0xfff8ee, w: 14, h: 10, p: [-7.6, 6.6, 7.6] },
    fill: { c: 0xeaf1ff, w: 15, h: 11, p: [9.4, 2.6, 5.8] },
    rim: { c: 0xffffff, w: 1.8, h: 16, p: [0.8, 6.2, -10.5] },
    bounce: { c: 0xfff4e6, w: 13, h: 13, p: [0.4, -3.2, 4.2] },
    top: { c: 0xffffff, w: 15, h: 15, p: [0, 10.5, 1.0] },
  };

  for (const name of Object.keys(RIG)) {
    const p = RIG[name];
    const light = new THREE.RectAreaLight(p.c, params[LIGHT_KEYS[name]], p.w, p.h);
    light.position.set(p.p[0], p.p[1], p.p[2]);
    light.lookAt(0, 2, 0);
    scene.add(light);
    rectLights[name] = light;
  }

  // 平行光只负责投影，让接触阴影柔和落下
  dirShadow = new THREE.DirectionalLight(0xfff2e0, params.shadowIntensity);
  dirShadow.position.set(-7.6, 6.6, 7.6);
  dirShadow.target.position.set(0, 1.5, 0);
  dirShadow.castShadow = params.shadowOn;
  dirShadow.shadow.mapSize.set(2048, 2048);
  dirShadow.shadow.camera.near = 1;
  dirShadow.shadow.camera.far = 45;
  const d = 9;
  Object.assign(dirShadow.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
  dirShadow.shadow.bias = -0.0004;
  dirShadow.shadow.normalBias = 0.02;
  dirShadow.shadow.radius = 7;
  scene.add(dirShadow);
  scene.add(dirShadow.target);

  // 环境光兜底，避免背光面死黑
  hemiLight = new THREE.HemisphereLight(0xffffff, 0xb9b4a8, params.hemiIntensity);
  scene.add(hemiLight);
};

/* ----------------------------- 地面 ----------------------------- */

const createFloor = () => {
  // 大圆形地面，接收阴影
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(70, 128),
    new THREE.MeshStandardMaterial({
      color: params.floorColor,
      roughness: params.floorRoughness,
      metalness: 0.0,
      envMapIntensity: 0.5,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);
  floorMesh = floor;

  // 软阴影承接层，压深接触区域
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 46),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: params.shadowOpacity, transparent: true, depthWrite: false })
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = FLOOR_Y + 0.006;
  catcher.receiveShadow = true;
  catcher.renderOrder = 2;
  scene.add(catcher);
  shadowCatcher = catcher;

  // 中央暖白光池
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(11, 64),
    new THREE.MeshBasicMaterial({
      map: createPoolTexture(),
      color: 0xfff6e8,
      transparent: true,
      opacity: params.poolOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = FLOOR_Y + 0.012;
  pool.renderOrder = 3;
  scene.add(pool);
  lightPool = pool;
};

/* ----------------------------- 空气尘埃 ----------------------------- */

let dust = null;
const dustState = { pos: null, seed: null, speed: null, count: 220 };

const createDust = () => {
  const n = dustState.count;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 34;
    pos[i * 3 + 1] = -3 + Math.random() * 15;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 34;
    seed[i] = Math.random() * 100;
    speed[i] = 0.05 + Math.random() * 0.12;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: params.dustSize,
    map: createDustSprite(),
    color: 0xfff2df,
    transparent: true,
    opacity: params.dustOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  dust = new THREE.Points(geo, mat);
  dust.frustumCulled = false;
  dust.visible = params.dustOn;
  scene.add(dust);

  dustState.pos = pos;
  dustState.seed = seed;
  dustState.speed = speed;
};

const updateDust = (dt, t) => {
  if (!dust) return;
  const p = dustState.pos;
  for (let i = 0; i < dustState.count; i++) {
    const j = i * 3;
    p[j] += Math.sin(t * 0.4 + dustState.seed[i]) * 0.012 * dt;
    p[j + 1] += dustState.speed[i] * params.dustSpeed * dt;
    p[j + 2] += Math.cos(t * 0.33 + dustState.seed[i]) * 0.012 * dt;
    if (p[j + 1] > 12) {
      p[j + 1] = -3;
      p[j] = (Math.random() - 0.5) * 34;
      p[j + 2] = (Math.random() - 0.5) * 34;
    }
  }
  dust.geometry.attributes.position.needsUpdate = true;
};

/* ----------------------------- 体积雾卡 ----------------------------- */

// 三层雾卡：始终贴在模型相对相机的后方，制造“雾挡在物体后面”的层次感
let fogCards = [];

// 雾卡贴图：径向渐变 + 随机斑驳，只保留 alpha 形态
const createFogCardTexture = () => {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');

  const g = ctx.createRadialGradient(s / 2, s * 0.56, 0, s / 2, s * 0.56, s * 0.52);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.26)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // 随机挖掉一些细碎斑块，避免雾卡像一块干净的渐变
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    const r = 3 + Math.random() * 26;
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.push(tex);
  return tex;
};

const createFogCards = () => {
  const tex = createFogCardTexture();
  // 距模型中心的距离 / 尺寸 / 基础不透明度
  const defs = [
    { dist: 10, w: 46, h: 28, opacity: 0.18 },
    { dist: 20, w: 76, h: 46, opacity: 0.12 },
    { dist: 34, w: 120, h: 72, opacity: 0.08 },
  ];

  defs.forEach((d, i) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(d.w, d.h),
      new THREE.MeshBasicMaterial({
        map: tex,
        color: new THREE.Color('#1e3147'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      })
    );
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    scene.add(mesh);
    fogCards.push({ mesh, dist: d.dist, base: d.opacity, seed: i * 1.7 });
  });
};

// 雾卡沿相机视线排到模型后方，并加极缓慢漂移
const updateFogCards = (t) => {
  if (!fogCards.length || !camera || lookTechAmount < 0.001) return;

  const center = controls ? controls.target : new THREE.Vector3(0, FLOOR_Y + 3, 0);
  const back = camera.position.clone().sub(center).normalize();

  fogCards.forEach((card) => {
    card.mesh.position.copy(center).addScaledVector(back, -card.dist);
    card.mesh.position.x += Math.sin(t * 0.05 + card.seed) * 1.6;
    card.mesh.position.y += Math.cos(t * 0.04 + card.seed) * 0.8;
    card.mesh.lookAt(camera.position);
  });
};

/* ----------------------------- 调色 Shader ----------------------------- */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: params.grain },
    uVig: { value: params.vignette },
    uCA: { value: params.chromatic },
    uSat: { value: params.saturation },
    uHal: { value: params.halation },
    uHalColor: { value: new THREE.Color('#ffad6b') },
    uEdge: { value: params.edgeBlur },
    uFocus: { value: params.focus },
    uFade: { value: 1.0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVig, uCA, uSat, uHal, uEdge, uFocus, uFade;
    uniform vec3 uHalColor;
    uniform vec2 uCenter, uTexel;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    vec3 disc(vec2 uv, vec2 r) {
      vec3 s = texture2D(tDiffuse, uv).rgb * 0.22;
      s += texture2D(tDiffuse, uv + vec2(r.x, 0.0)).rgb * 0.10;
      s += texture2D(tDiffuse, uv - vec2(r.x, 0.0)).rgb * 0.10;
      s += texture2D(tDiffuse, uv + vec2(0.0, r.y)).rgb * 0.10;
      s += texture2D(tDiffuse, uv - vec2(0.0, r.y)).rgb * 0.10;
      s += texture2D(tDiffuse, uv + r * 0.70).rgb * 0.095;
      s += texture2D(tDiffuse, uv - r * 0.70).rgb * 0.095;
      s += texture2D(tDiffuse, uv + vec2(r.x, -r.y) * 0.70).rgb * 0.095;
      s += texture2D(tDiffuse, uv + vec2(-r.x, r.y) * 0.70).rgb * 0.095;
      return s;
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);

      // 画面边缘轻微离焦，视线更集中在主体上
      float def = smoothstep(uFocus, uFocus + 0.40, distance(uv, uCenter)) * uEdge;
      vec2 blur = uTexel * (1.0 + def * 3.2);

      vec2 off = d * r2 * uCA * 0.006;
      vec3 c;
      c.r = disc(uv + off, blur).r;
      c.g = disc(uv, blur).g;
      c.b = disc(uv - off, blur).b;

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // 分离色调：冷暗部 / 暖高光
      c *= mix(vec3(0.965, 0.99, 1.02), vec3(1.02, 1.0, 0.972), smoothstep(0.16, 0.86, l));
      // 高光轻微溢出（颜色随外观预设变化：暖橙 / 冷蓝）
      c += uHalColor * smoothstep(0.85, 1.0, l) * uHal;
      c = mix(vec3(l), c, uSat);

      // 暗角
      float vig = smoothstep(1.22, 0.30, length(d) * 1.38);
      c *= mix(1.0, vig, uVig);

      // 胶片颗粒
      float g = hash(uv * vec2(1927.0, 1087.0) + fract(uTime) * 91.7);
      c += (g - 0.5) * uGrain * mix(1.2, 0.4, smoothstep(0.0, 0.8, l));

      gl_FragColor = vec4(c * uFade, 1.0);
    }
  `,
};

/* ----------------------------- 调试面板 (lil-gui) ----------------------------- */

const setGradeUniform = (key, value) => {
  if (gradePass) gradePass.uniforms[key].value = value;
};

// 给 three 自带 SSAOPass 的 AO 着色器打补丁：
// 1) 遮蔽值乘 uIntensity，最暗只压到 (1 - uIntensity)，不会出现纯黑线
// 2) 深度差判定由硬边改为 smoothstep 窗口，遮蔽边缘更柔和
const patchSSAOShader = (pass) => {
  if (!pass || !pass.ssaoMaterial) return;
  const mat = pass.ssaoMaterial;
  if (!mat.uniforms.uIntensity) mat.uniforms.uIntensity = { value: params.aoIntensity };
  if (!mat.uniforms.uSoftness) mat.uniforms.uSoftness = { value: params.aoSoftness };

  let src = mat.fragmentShader;
  src = src.replace(
    /(uniform float minDistance;[^\n]*\n)/,
    '$1\t\t\tuniform float uIntensity;\n\t\t\tuniform float uSoftness;\n'
  );
  src = src.replace(
    /if \( delta > minDistance && delta < maxDistance \) \{[^}]*\}/,
    [
      'float softRange = max( uSoftness * ( maxDistance - minDistance ), 1e-6 );',
      'float weight = smoothstep( minDistance, minDistance + softRange, delta )',
      '\t* ( 1.0 - smoothstep( maxDistance - softRange, maxDistance, delta ) );',
      'occlusion += weight;',
    ].join('\n\t\t\t\t\t')
  );
  src = src.replace(
    /gl_FragColor = vec4\( vec3\( 1\.0 - occlusion \), 1\.0 \);/,
    'gl_FragColor = vec4( vec3( 1.0 - occlusion * uIntensity ), 1.0 );'
  );

  if (!src.includes('occlusion * uIntensity')) {
    console.warn('[ThreeCassette] SSAO 着色器补丁未生效，three 版本可能已变更');
    return;
  }

  mat.fragmentShader = src;
  mat.needsUpdate = true;
};

/* ----------------------- 外观预设（柔光棚 / 科技蓝） ----------------------- */

// 两套外观的全部色值与强度；切换时按进度插值，结构元素（网格/描边/雾/扫描环）随进度淡入
const LOOKS = {
  studio: {
    exposure: 0.8,
    envIntensity: 0.6,
    modelEnv: 0.8,
    keyColor: '#fff8ee', keyIntensity: 1.75,
    fillColor: '#eaf1ff', fillIntensity: 1.05,
    rimColor: '#ffffff', rimIntensity: 1.05,
    bounceColor: '#fff4e6', bounceIntensity: 0.5,
    topColor: '#ffffff', topIntensity: 0.48,
    hemiSky: '#ffffff', hemiGround: '#b9b4a8', hemiIntensity: 0.26,
    dirColor: '#fff2e0', dirIntensity: 0.5,
    sceneBg: '#c6c9ce',
    floorColor: '#b4b9c0', floorRoughness: 0.5, floorMetalness: 0.0, floorEnv: 0.5,
    poolColor: '#fff6e8', poolOpacity: 0.14,
    dustColor: '#fff2df', dustOpacity: 0.42,
    bloomStrength: 0.22, bloomRadius: 0.62, bloomThreshold: 0.86,
    vignette: 0.45, chromatic: 0.5, saturation: 1.02, halation: 0.02, grain: 0.032,
    halColor: '#ffad6b',
    fogColor: '#c6c9ce', fogDensity: 0.0,
    aoIntensity: 0.75,
  },
  tech: {
    exposure: 0.85,
    envIntensity: 0.75,
    modelEnv: 1.15,
    keyColor: '#dce9ff', keyIntensity: 1.5,
    fillColor: '#9fc4ff', fillIntensity: 0.75,
    rimColor: '#8fe0ff', rimIntensity: 2.2,
    bounceColor: '#2f4a70', bounceIntensity: 0.18,
    topColor: '#cfe0ff', topIntensity: 0.55,
    hemiSky: '#dfefff', hemiGround: '#24334a', hemiIntensity: 0.3,
    dirColor: '#cfe2ff', dirIntensity: 0.45,
    sceneBg: '#070c16',
    floorColor: '#0e1626', floorRoughness: 0.22, floorMetalness: 0.35, floorEnv: 0.9,
    poolColor: '#2f7dff', poolOpacity: 0.35,
    dustColor: '#9fd0ff', dustOpacity: 0.75,
    bloomStrength: 0.5, bloomRadius: 0.55, bloomThreshold: 0.6,
    vignette: 0.6, chromatic: 0.5, saturation: 1.05, halation: 0.03, grain: 0.026,
    halColor: '#73bfff',
    fogColor: '#1e3147', fogDensity: 0.03,
    aoIntensity: 0.6,
  },
};

const LIGHT_NAMES = ['key', 'fill', 'rim', 'bounce', 'top'];

let currentLook = { ...LOOKS.studio };
let lookTechAmount = 0;   // 0 = 完全柔光棚，1 = 完全科技蓝
const lookTween = { running: false, t: 0, duration: 0.6, fromAmount: 0, toTech: false };

const lerpLook = (a, b, k) => {
  const out = {};
  for (const key of Object.keys(b)) {
    const va = a[key];
    const vb = b[key];
    if (typeof vb === 'number') {
      out[key] = (typeof va === 'number' ? va : vb) + (vb - (typeof va === 'number' ? va : vb)) * k;
    } else {
      out[key] = '#' + new THREE.Color(va).lerp(new THREE.Color(vb), k).getHexString();
    }
  }
  return out;
};

// 把一套外观值写入场景（techAmount 控制科技元素与背景的交叉淡化）
const applyLookState = (s, techAmount = 0) => {
  if (renderer) renderer.toneMappingExposure = s.exposure;
  if (scene) scene.environmentIntensity = s.envIntensity;

  for (const name of LIGHT_NAMES) {
    const light = rectLights[name];
    if (!light) continue;
    light.color.set(s[name + 'Color']);
    light.intensity = s[name + 'Intensity'];
  }
  if (dirShadow) {
    dirShadow.color.set(s.dirColor);
    dirShadow.intensity = s.dirIntensity;
  }
  if (hemiLight) {
    hemiLight.color.set(s.hemiSky);
    hemiLight.groundColor.set(s.hemiGround);
    hemiLight.intensity = s.hemiIntensity;
  }
  if (scene && scene.background) scene.background.set(s.sceneBg);

  if (floorMesh) {
    const m = floorMesh.material;
    m.color.set(s.floorColor);
    m.roughness = s.floorRoughness;
    m.metalness = s.floorMetalness;
    m.envMapIntensity = s.floorEnv;
  }
  if (lightPool) {
    lightPool.material.color.set(s.poolColor);
    lightPool.material.opacity = s.poolOpacity;
  }
  if (dust) {
    dust.material.color.set(s.dustColor);
    dust.material.opacity = s.dustOpacity;
  }

  if (bloomPass) {
    bloomPass.strength = s.bloomStrength;
    bloomPass.radius = s.bloomRadius;
    bloomPass.threshold = s.bloomThreshold;
  }
  if (gradePass) {
    setGradeUniform('uVig', s.vignette);
    setGradeUniform('uCA', s.chromatic);
    setGradeUniform('uSat', s.saturation);
    setGradeUniform('uHal', s.halation);
    setGradeUniform('uGrain', s.grain);
    gradePass.uniforms.uHalColor.value.set(s.halColor);
  }
  if (ssaoPass && ssaoPass.ssaoMaterial?.uniforms?.uIntensity) {
    ssaoPass.ssaoMaterial.uniforms.uIntensity.value = s.aoIntensity;
  }

  if (scene && scene.fog) {
    scene.fog.color.set(s.fogColor);
    scene.fog.density = s.fogDensity * (params.fogOn ? 1 : 0) * techAmount;
  }

  // 雾卡：颜色跟随雾色，透明度随过渡与体积雾开关变化
  if (fogCards.length) {
    fogCards.forEach((card) => {
      card.mesh.material.color.set(s.fogColor);
      card.mesh.material.opacity = card.base * techAmount * (params.fogOn ? 1 : 0);
    });
  }

  // 两套背景穹顶交叉淡化
  if (backdropWarm) backdropWarm.material.opacity = 1 - techAmount;
  if (backdropTech) backdropTech.material.opacity = techAmount;

  // 科技元素：扫描环 + 光锥随过渡渐显
  if (scanRing) scanRing.material.opacity = techAmount * (params.scanOn ? 0.85 : 0);
  if (scanCone) scanCone.material.opacity = techAmount * (params.scanOn ? 0.34 : 0);

  // 两套 PMREM 无法插值，取过渡中点切换
  if (scene && params.envOn) {
    const nextEnv = techAmount < 0.5 ? envTextures.studio : envTextures.tech;
    if (nextEnv && scene.environment !== nextEnv) scene.environment = nextEnv;
  }
};

// 过渡结束后把面板数值同步到新预设，保证 GUI 显示的永远是当前真值
const syncParamsFromLook = (s) => {
  params.exposure = s.exposure;
  params.envIntensity = s.envIntensity;
  params.modelEnvIntensity = s.modelEnv;
  params.keyIntensity = s.keyIntensity;
  params.fillIntensity = s.fillIntensity;
  params.rimIntensity = s.rimIntensity;
  params.bounceIntensity = s.bounceIntensity;
  params.topIntensity = s.topIntensity;
  params.hemiIntensity = s.hemiIntensity;
  params.shadowIntensity = s.dirIntensity;
  params.floorColor = s.floorColor;
  params.floorRoughness = s.floorRoughness;
  params.poolOpacity = s.poolOpacity;
  params.dustOpacity = s.dustOpacity;
  params.bloomStrength = s.bloomStrength;
  params.bloomRadius = s.bloomRadius;
  params.bloomThreshold = s.bloomThreshold;
  params.vignette = s.vignette;
  params.chromatic = s.chromatic;
  params.saturation = s.saturation;
  params.halation = s.halation;
  params.grain = s.grain;
  params.aoIntensity = s.aoIntensity;
  updateModelEnv();
  if (gui) gui.controllersRecursive().forEach((c) => c.updateDisplay());
};

// 根据过渡进度推进（在渲染循环里调用）
const updateLookTween = (dt) => {
  if (!lookTween.running) return;
  lookTween.t = Math.min(1, lookTween.t + dt / Math.max(0.05, lookTween.duration));
  const t = lookTween.t;
  const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const target = lookTween.toTech ? 1 : 0;
  const from = lookTween.fromAmount;
  lookTechAmount = from + (target - from) * k;
  currentLook = lerpLook(lookTween.fromLook, lookTween.toLook, k);
  applyLookState(currentLook, lookTechAmount);

  if (t >= 1) {
    lookTween.running = false;
    lookTechAmount = target;
    currentLook = { ...lookTween.toLook };
    applyLookState(currentLook, lookTechAmount);
    syncParamsFromLook(lookTween.toLook);
  }
};

// 扫描光锥：底边最亮、向上快速衰减
const createScanConeTexture = () => {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0.0, 'rgba(150,232,255,0.85)');
  g.addColorStop(0.25, 'rgba(120,214,255,0.35)');
  g.addColorStop(0.65, 'rgba(90,190,255,0.10)');
  g.addColorStop(1.0, 'rgba(70,170,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.push(tex);
  return tex;
};

// 扫描元素按需创建（柔光棚模式下不占资源）
const ensureScanAssets = () => {
  if (!scene || scanRing) return;

  // 内层：高亮细环（颜色进入 HDR 区间，供 Bloom 拾取）
  scanRing = new THREE.Mesh(
    new THREE.RingGeometry(3.34, 3.42, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(1.2, 3.0, 3.8),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    })
  );
  scanRing.rotation.x = -Math.PI / 2;
  scanRing.position.y = FLOOR_Y + 0.1;
  scanRing.renderOrder = 4;
  scene.add(scanRing);

  // 外层：低矮光锥，给扫描一个体积感
  scanCone = new THREE.Mesh(
    new THREE.CylinderGeometry(3.42, 3.42, 1.15, 128, 1, true),
    new THREE.MeshBasicMaterial({
      map: createScanConeTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    })
  );
  scanCone.position.y = FLOOR_Y + 0.1 + 1.15 / 2;
  scanCone.renderOrder = 4;
  scene.add(scanCone);
};

const switchLook = (name, duration) => {
  if (!LOOKS[name] || !scene) return;
  const toTech = name === 'tech';
  if (toTech === lookTween.toTech && !lookTween.running && lookName.value === name) return;

  lookName.value = name;
  params.look = name;
  ensureScanAssets();

  lookTween.fromLook = { ...currentLook };
  lookTween.toLook = { ...LOOKS[name] };
  lookTween.fromAmount = lookTechAmount;
  lookTween.toTech = toTech;
  lookTween.t = 0;
  lookTween.duration = duration ?? params.lookTransition;
  lookTween.running = true;

  if (gui) gui.controllersRecursive().forEach((c) => c.updateDisplay());
};

// 科技元素开关变化时立刻重算透明度（不跑整个过渡）
const refreshTechOpacity = () => {
  if (scanRing) scanRing.material.opacity = lookTechAmount * (params.scanOn ? 0.85 : 0);
  if (scanCone) scanCone.material.opacity = lookTechAmount * (params.scanOn ? 0.34 : 0);
  if (scene && scene.fog) scene.fog.density = LOOKS.tech.fogDensity * (params.fogOn ? 1 : 0) * lookTechAmount;

  if (fogCards.length) {
    fogCards.forEach((card) => {
      card.mesh.material.color.set(currentLook.fogColor);
      card.mesh.material.opacity = card.base * lookTechAmount * (params.fogOn ? 1 : 0);
    });
  }
};

const updateModelEnv = () => {
  if (!modelRoot) return;
  modelRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (m && 'envMapIntensity' in m) m.envMapIntensity = params.modelEnvIntensity;
    });
  });
};

const updateModelRoughness = () => {
  if (!modelRoot) return;
  modelRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m || typeof m.roughness !== 'number') return;
      if (m.userData.baseRoughness === undefined) m.userData.baseRoughness = m.roughness;
      m.roughness = Math.max(m.userData.baseRoughness, params.roughnessFloor);
    });
  });
};

const setupGUI = () => {
  if (gui) gui.destroy();
  gui = new GUI({ title: '柔光场景调节' });

  // ---- 外观预设 ----
  const fLook = gui.addFolder('外观预设');
  fLook
    .add(params, 'look', { '柔光棚 Studio': 'studio', '科技蓝 Tech': 'tech' })
    .name('外观')
    .onChange((v) => switchLook(v));
  fLook.add(params, 'lookTransition', 0.1, 1.6, 0.05).name('过渡时长(秒)');
  fLook.add(params, 'fogOn').name('体积雾').onChange(refreshTechOpacity);
  fLook.add(params, 'scanOn').name('扫描环').onChange(refreshTechOpacity);

  // ---- 色调 / 背景 ----
  const fTone = gui.addFolder('色调 / 背景');
  fTone.add(params, 'exposure', 0.2, 1.6, 0.01).name('曝光').onChange((v) => {
    if (renderer) renderer.toneMappingExposure = v;
  });
  fTone
    .add(params, 'toneMapping', { Neutral: 'Neutral', ACES: 'ACES', Linear: 'Linear', Reinhard: 'Reinhard' })
    .name('色调映射')
    .onChange((v) => {
      if (renderer) renderer.toneMapping = TONE_MAPPINGS[v] ?? THREE.ACESFilmicToneMapping;
    });
  fTone.add(params, 'backdropLevel', 0.5, 1.4, 0.01).name('背景亮度').onChange((v) => {
    if (backdropWarm) backdropWarm.material.color.setScalar(v);
    if (backdropTech) backdropTech.material.color.setScalar(v);
  });

  // ---- 柔光箱布光 ----
  const fLight = gui.addFolder('柔光箱布光');
  fLight.add(params, 'keyIntensity', 0, 4, 0.05).name('主光 Key').onChange((v) => {
    if (rectLights.key) rectLights.key.intensity = v;
  });
  fLight.add(params, 'fillIntensity', 0, 4, 0.05).name('辅光 Fill').onChange((v) => {
    if (rectLights.fill) rectLights.fill.intensity = v;
  });
  fLight.add(params, 'rimIntensity', 0, 4, 0.05).name('轮廓光 Rim').onChange((v) => {
    if (rectLights.rim) rectLights.rim.intensity = v;
  });
  fLight.add(params, 'bounceIntensity', 0, 3, 0.05).name('反弹光 Bounce').onChange((v) => {
    if (rectLights.bounce) rectLights.bounce.intensity = v;
  });
  fLight.add(params, 'topIntensity', 0, 3, 0.05).name('顶部光 Top').onChange((v) => {
    if (rectLights.top) rectLights.top.intensity = v;
  });
  fLight.add(params, 'shadowOn').name('平行光投影').onChange((v) => {
    if (dirShadow) dirShadow.castShadow = v;
  });
  fLight.add(params, 'shadowIntensity', 0, 2, 0.05).name('阴影光强度').onChange((v) => {
    if (dirShadow) dirShadow.intensity = v;
  });
  fLight.add(params, 'hemiIntensity', 0, 1.5, 0.02).name('半球补光').onChange((v) => {
    if (hemiLight) hemiLight.intensity = v;
  });

  // ---- 环境与材质 ----
  const fEnv = gui.addFolder('环境与材质');
  fEnv.add(params, 'envOn').name('PMREM 环境').onChange((v) => {
    if (!scene) return;
    if (!v) {
      scene.environment = null;
    } else {
      scene.environment = lookTechAmount < 0.5 ? envTextures.studio : envTextures.tech;
    }
  });
  fEnv.add(params, 'envIntensity', 0, 2, 0.05).name('环境强度').onChange((v) => {
    if (scene) scene.environmentIntensity = v;
  });
  fEnv.add(params, 'modelEnvIntensity', 0, 2, 0.05).name('模型反射强度').onChange(updateModelEnv);
  fEnv.add(params, 'roughnessFloor', 0, 1, 0.01).name('粗糙度下限').onChange(updateModelRoughness);

  // ---- 地面与光池 ----
  const fFloor = gui.addFolder('地面与光池');
  fFloor.addColor(params, 'floorColor').name('地面颜色').onChange((v) => {
    if (floorMesh) floorMesh.material.color.set(v);
  });
  fFloor.add(params, 'floorRoughness', 0, 1, 0.01).name('地面粗糙度').onChange((v) => {
    if (floorMesh) floorMesh.material.roughness = v;
  });
  fFloor.add(params, 'shadowOpacity', 0, 0.6, 0.01).name('接触阴影').onChange((v) => {
    if (shadowCatcher) shadowCatcher.material.opacity = v;
  });
  fFloor.add(params, 'poolOpacity', 0, 0.6, 0.01).name('光池强度').onChange((v) => {
    if (lightPool) lightPool.material.opacity = v;
  });

  // ---- 后期处理 ----
  const fPost = gui.addFolder('后期处理');
  fPost.add(params, 'bloomOn').name('Bloom').onChange((v) => {
    if (bloomPass) bloomPass.enabled = v;
  });
  fPost.add(params, 'bloomStrength', 0, 2, 0.01).name('Bloom 强度').onChange((v) => {
    if (bloomPass) bloomPass.strength = v;
  });
  fPost.add(params, 'bloomRadius', 0, 1.5, 0.01).name('Bloom 半径').onChange((v) => {
    if (bloomPass) bloomPass.radius = v;
  });
  fPost.add(params, 'bloomThreshold', 0, 1, 0.01).name('Bloom 阈值').onChange((v) => {
    if (bloomPass) bloomPass.threshold = v;
  });
  fPost.add(params, 'ssaoOn').name('SSAO').onChange((v) => {
    if (ssaoPass) ssaoPass.enabled = v;
  });
  fPost.add(params, 'ssaoRadius', 0.02, 1, 0.01).name('SSAO 半径').onChange((v) => {
    if (ssaoPass) ssaoPass.kernelRadius = v;
  });
  fPost.add(params, 'ssaoMinDistance', 0.00001, 0.002, 0.00001).name('AO 最小深度差').onChange((v) => {
    if (ssaoPass) ssaoPass.minDistance = v;
  });
  fPost.add(params, 'ssaoMaxDistance', 0.0002, 0.004, 0.0001).name('AO 最大深度差').onChange((v) => {
    if (ssaoPass) ssaoPass.maxDistance = v;
  });
  fPost.add(params, 'aoIntensity', 0, 1, 0.01).name('AO 强度上限').onChange((v) => {
    if (ssaoPass && ssaoPass.ssaoMaterial.uniforms.uIntensity) {
      ssaoPass.ssaoMaterial.uniforms.uIntensity.value = v;
    }
  });
  fPost.add(params, 'aoSoftness', 0, 1, 0.01).name('AO 边缘柔化').onChange((v) => {
    if (ssaoPass && ssaoPass.ssaoMaterial.uniforms.uSoftness) {
      ssaoPass.ssaoMaterial.uniforms.uSoftness.value = v;
    }
  });
  fPost.add(params, 'grain', 0, 0.2, 0.002).name('胶片颗粒').onChange((v) => setGradeUniform('uGrain', v));
  fPost.add(params, 'vignette', 0, 1, 0.01).name('暗角').onChange((v) => setGradeUniform('uVig', v));
  fPost.add(params, 'chromatic', 0, 2, 0.01).name('色散').onChange((v) => setGradeUniform('uCA', v));
  fPost.add(params, 'saturation', 0.5, 1.5, 0.01).name('饱和度').onChange((v) => setGradeUniform('uSat', v));
  fPost.add(params, 'halation', 0, 0.2, 0.002).name('高光溢出').onChange((v) => setGradeUniform('uHal', v));
  fPost.add(params, 'edgeBlur', 0, 1.5, 0.01).name('边缘离焦').onChange((v) => setGradeUniform('uEdge', v));
  fPost.add(params, 'focus', 0, 1, 0.01).name('离焦起点').onChange((v) => setGradeUniform('uFocus', v));

  // ---- 相机与动画 ----
  const fCam = gui.addFolder('相机与动画');
  fCam.add(params, 'autoRotate').name('自动旋转').onChange((v) => {
    if (controls) controls.autoRotate = v;
  });
  fCam.add(params, 'autoRotateSpeed', 0, 2, 0.01).name('旋转速度').onChange((v) => {
    if (controls) controls.autoRotateSpeed = v;
  });
  fCam.add(params, 'fov', 20, 60, 1).name('视场角 FOV').onChange((v) => {
    if (camera) {
      camera.fov = v;
      camera.updateProjectionMatrix();
    }
  });

  // ---- 空气尘埃 ----
  const fDust = gui.addFolder('空气尘埃');
  fDust.add(params, 'dustOn').name('显示').onChange((v) => {
    if (dust) dust.visible = v;
  });
  fDust.add(params, 'dustSize', 0.01, 0.2, 0.005).name('粒子大小').onChange((v) => {
    if (dust) dust.material.size = v;
  });
  fDust.add(params, 'dustOpacity', 0, 1, 0.01).name('不透明度').onChange((v) => {
    if (dust) dust.material.opacity = v;
  });
  fDust.add(params, 'dustSpeed', 0, 3, 0.05).name('漂浮速度');

  fLight.close();
  fFloor.close();
  fCam.close();
  fDust.close();
};

/* ----------------------------- 核心初始化 ----------------------------- */

const init = () => {
  const { elementSize, updateElementSize, bindRenderer } = useElementSize('.three-container');
  updateElementSize();

  canvas = document.querySelector('.webgl_11');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc6c9ce);

  camera = new THREE.PerspectiveCamera(
    params.fov,
    elementSize.value.width / elementSize.value.height,
    0.5,
    200
  );
  camera.position.set(8.5, 5.6, 15.5);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 1.8, 0);
  controls.minDistance = 6;
  controls.maxDistance = 42;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;
  controls.enablePan = false;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(elementSize.value.width, elementSize.value.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = TONE_MAPPINGS[params.toneMapping];
  renderer.toneMappingExposure = params.exposure;

  bindRenderer(renderer, camera);

  // 环境贴图（柔和反射）：两套 PMREM 一次烘焙，切换时按过渡中点替换
  pmrem = new THREE.PMREMGenerator(renderer);
  envTextures.studio = buildEnvironment('studio');
  envTextures.tech = buildEnvironment('tech');
  envTexture = envTextures.studio;   // 兼容旧引用
  scene.environment = params.envOn ? envTextures.studio : null;
  scene.environmentIntensity = params.envIntensity;

  // 体积雾常驻但密度为 0：避免切换外观时重编译材质
  scene.fog = new THREE.FogExp2(0xc6c9ce, 0);

  // 两套背景穹顶叠在一起，切换外观时交叉淡化
  const makeBackdrop = (kind, radius, order) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 32),
      new THREE.MeshBasicMaterial({
        map: createBackdropTexture(kind),
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        transparent: true,
        fog: false,
        opacity: kind === 'studio' ? 1 : 0,
      })
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    scene.add(mesh);
    return mesh;
  };
  backdropWarm = makeBackdrop('studio', 80, 0);
  backdropTech = makeBackdrop('tech', 79.6, 1);
  if (params.backdropLevel !== 1) {
    backdropWarm.material.color.setScalar(params.backdropLevel);
    backdropTech.material.color.setScalar(params.backdropLevel);
  }

  createLights();
  createFloor();
  createDust();
  createFogCards();

  // ===== 后期：SSAO → Bloom → Output → Grade =====
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  ssaoPass = new SSAOPass(scene, camera, elementSize.value.width, elementSize.value.height);
  ssaoPass.kernelRadius = params.ssaoRadius;
  ssaoPass.minDistance = params.ssaoMinDistance;
  ssaoPass.maxDistance = params.ssaoMaxDistance;
  ssaoPass.enabled = params.ssaoOn;
  patchSSAOShader(ssaoPass);
  composer.addPass(ssaoPass);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(elementSize.value.width, elementSize.value.height),
    params.bloomStrength, // 强度：只给窗灯/高光一点柔光
    params.bloomRadius,   // 半径
    params.bloomThreshold // 阈值：只吃到高亮
  );
  bloomPass.enabled = params.bloomOn;
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  gradePass = new ShaderPass(GradeShader);
  gradePass.uniforms.uTexel.value.set(
    1 / Math.max(1, elementSize.value.width),
    1 / Math.max(1, elementSize.value.height)
  );
  composer.addPass(gradePass);

  // 容器尺寸变化时同步后期链路
  const container = document.querySelector('.three-container');
  if (container) {
    labelResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;
        if (composer) composer.setSize(width, height);
        if (gradePass) {
          gradePass.uniforms.uTexel.value.set(1 / width, 1 / height);
        }
      }
    });
    labelResizeObserver.observe(container);
  }

  loadModel();
  setupGUI();
  applyLookState(currentLook, lookTechAmount);

  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    updateLookTween(dt);
    updateDust(dt, t);
    updateFogCards(t);
    if (gradePass) gradePass.uniforms.uTime.value = t;

    // 扫描环 + 光锥同步在模型高度范围内往复
    if (scanRing && scanRing.material.opacity > 0.001) {
      const h = modelRoot ? 5.8 : 4.2;
      const baseY = FLOOR_Y + 0.08 + (0.5 - 0.5 * Math.cos(t * 0.55)) * h;
      scanRing.position.y = baseY;
      if (scanCone) scanCone.position.y = baseY + 1.15 / 2;
    }

    controls.update();
    composer.render();
    animationId = requestAnimationFrame(tick);
  };
  tick();
};

/* ----------------------------- 模型加载 ----------------------------- */

// 让模型适配场景：最大边 6 个单位、水平居中、底部落在 FLOOR_Y
const fitModel = (model) => {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  model.scale.setScalar(6 / maxDim);

  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fitted.min.y;
  model.position.y += FLOOR_Y;

  const height = fitted.max.y - fitted.min.y;
  return { height, centerY: FLOOR_Y + height / 2 };
};

// 保留 GLB 自带 PBR 材质，只统一增强环境反射与阴影
const applyStudioMaterials = (model) => {
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    // 蒙皮/骨骼模型不需要额外处理
    if (obj.isSkinnedMesh) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m) return;
      if ('envMapIntensity' in m) m.envMapIntensity = params.modelEnvIntensity;
      // 极低粗糙度的金属在近白环境下会镜面反射背景，看起来像“透空”，按面板下限抬起
      if (typeof m.roughness === 'number') {
        if (m.userData.baseRoughness === undefined) m.userData.baseRoughness = m.roughness;
        m.roughness = Math.max(m.userData.baseRoughness, params.roughnessFloor);
      }
      // 双面材质在柔光棚里容易脏，统一回单面（原始材质本身多为单面）
      if (m.side === THREE.BackSide) m.side = THREE.FrontSide;
    });
  });
};

const loadModel = () => {
  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      endAssetLoading(assetToken);
      if (!scene) return;
      const model = gltf.scene;
      applyStudioMaterials(model);

      const { centerY } = fitModel(model);

      modelRoot = model;
      scene.add(model);

      // 相机与轨道中心对准模型中部
      controls.target.set(0, centerY, 0);
      camera.position.set(8.5, centerY + 3.4, 15.5);
      camera.lookAt(0, centerY, 0);
      controls.update();

      // 平行光阴影范围贴合模型
      dirShadow.target.position.set(0, centerY, 0);
      dirShadow.target.updateMatrixWorld();
    },
    (xhr) => {
      reportAssetProgress(assetToken, xhr.loaded, xhr.total);
    },
    (err) => {
      endAssetLoading(assetToken);
      console.warn('变电柜模型加载失败:', err);
    }
  );
};

/* ----------------------------- 卸载清理 ----------------------------- */

onBeforeUnmount(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (labelResizeObserver) {
    labelResizeObserver.disconnect();
    labelResizeObserver = null;
  }

  if (gui) {
    gui.destroy();
    gui = null;
  }

  try {
    if (controls) controls.dispose();
  } catch (e) {}
  controls = null;

  // 场景内几何体/材质/阴影贴图
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (!m) return;
          // 材质上的贴图（模型自带）
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
            if (m[key] && m[key].dispose) m[key].dispose();
          }
          m.dispose();
        });
      }
      if (obj.isDirectionalLight && obj.shadow?.map) obj.shadow.map.dispose();
    });
  }

  textures.forEach((t) => {
    try {
      t.dispose();
    } catch (e) {}
  });
  textures.length = 0;

  try {
    if (envTextures.studio) envTextures.studio.dispose();
    if (envTextures.tech) envTextures.tech.dispose();
  } catch (e) {}
  envTextures = { studio: null, tech: null };
  envTexture = null;

  scanRing = null;
  scanCone = null;
  fogCards = [];
  backdropWarm = null;
  backdropTech = null;
  lookTween.running = false;
  lookTechAmount = 0;
  currentLook = { ...LOOKS.studio };

  try {
    if (pmrem) pmrem.dispose();
  } catch (e) {}
  pmrem = null;

  try {
    if (ssaoPass) ssaoPass.dispose();
  } catch (e) {}

  try {
    if (composer) composer.dispose();
  } catch (e) {}
  composer = null;
  ssaoPass = null;
  bloomPass = null;
  gradePass = null;

  try {
    if (renderer) renderer.dispose();
  } catch (e) {}
  renderer = null;
  camera = null;
  canvas = null;
  scene = null;
  modelRoot = null;
  dirShadow = null;
  dust = null;
  for (const k of Object.keys(rectLights)) delete rectLights[k];
});

onMounted(() => {
  init();
});
</script>

<style scoped>
.three-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #c6c9ce;
}
.webgl_11 {
  display: block;
  width: 100%;
  height: 100%;
}

/* 左上角外观切换（避开右侧 lil-gui 面板） */
.look-switch {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 14, 28, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.look-btn {
  appearance: none;
  border: 0;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.4;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.72);
  background: transparent;
  transition: background-color 0.22s ease, color 0.22s ease;
}
.look-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.10);
}
.look-btn.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.20);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}
</style>
