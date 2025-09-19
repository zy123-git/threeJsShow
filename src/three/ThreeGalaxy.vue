<template>
  <canvas class="webgl_1"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import * as dat from 'dat.gui';

let canvas = null;
let gui = null;
let renderer = null;
let scene = null;
let camera = null;

let shotRadius = 10; // 初始半径
let phi = Math.PI * 0.8; // 初始俯仰角 (90度，看向原点)
let theta = Math.PI * 0; // 初始方位角

// 鼠标拖动控制相机
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

// 根据滚轮方向调整半径
const zoomSpeed = 0.25; // 缩放速度

/**
 * 调试
 */
// 初始化 dat.GUI
gui = new dat.GUI();

//通过添加到对象的方式可以不用定义，适合一个对象中各个属性的添加，但变量名尽量简便
const parameters = {};
((parameters.insideColor = 0xff5588),
  (parameters.outsideColor = 0x881c98),
  (parameters.particlesCount = 12000),
  (parameters.armCount = 6),
  (parameters.radius = 12),
  (parameters.curvature = 0.3));

gui.addColor(parameters, 'insideColor').onChange(() => {
  initThree();
});
gui.addColor(parameters, 'outsideColor').onChange(() => {
  initThree();
});
gui
  .add(parameters, 'particlesCount')
  .min(4000)
  .max(40000)
  .step(1)
  .name('粒子数量')
  .onChange(() => {
    initThree();
  });
gui
  .add(parameters, 'armCount')
  .min(2)
  .max(12)
  .step(1)
  .name('旋臂数量')
  .onChange(() => {
    initThree();
  });
gui
  .add(parameters, 'radius')
  .min(1)
  .max(20)
  .step(0.01)
  .name('星系半径')
  .onChange(() => {
    initThree();
  });
gui
  .add(parameters, 'curvature')
  .min(0.25)
  .max(0.5)
  .step(0.01)
  .name('曲率')
  .onChange(() => {
    initThree();
  });

// 平方随机数（-1到1）
function squareRandom() {
  const temp = (Math.random() - 0.5) * 2;
  if (temp >= 0) {
    return temp * temp;
  }
  return -temp * temp;
}

function updateCameraPosition() {
  // 将球面坐标转换为笛卡尔坐标
  camera.position.x = shotRadius * Math.sin(phi) * Math.sin(theta);
  camera.position.y = shotRadius * Math.cos(phi);
  camera.position.z = shotRadius * Math.sin(phi) * Math.cos(theta);
  camera.lookAt(0, 0, 0); // 始终看向原点
};

const initThree = () => {
  //窗口大小信息
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  /**
   * 场景环境设置
   */
  //画布
  canvas = document.querySelector('canvas.webgl_1');
  // 场景
  scene = new THREE.Scene();


  /**
   * 物体
   */
  //纹理

  //材质
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.03,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  //星系粒子位置
  const angles = new Array(parameters.armCount).fill(0);
  const particlesPosition = new Float32Array(parameters.particlesCount * 3);
  const particlesColor = new Float32Array(parameters.particlesCount * 3);

  //每次调用初始化函数都会从gui那里取得最新值
  const colorInside = new THREE.Color(parameters.insideColor);
  const colorOutside = new THREE.Color(parameters.outsideColor);

  for (let i = 0; i < parameters.armCount; i++) {
    angles[i] = (Math.PI * 2 * i) / parameters.armCount;
  }

  for (let i = 0; i < parameters.particlesCount; i++) {
    //位置部分
    const particlesRadius = Math.abs(squareRandom()) * parameters.radius;

    particlesPosition[i * 3 + 0] =
      particlesRadius *
        Math.cos(angles[i % parameters.armCount] + parameters.curvature * particlesRadius) +
      (squareRandom() / (particlesRadius + 3)) * 6;
    particlesPosition[i * 3 + 1] =
      -particlesRadius *
        Math.sin(angles[i % parameters.armCount] + parameters.curvature * particlesRadius) +
      (squareRandom() / (particlesRadius + 3)) * 6;
    particlesPosition[i * 3 + 2] = (squareRandom() * 3.5) / (particlesRadius + 3);

    //颜色部分
    const mixedColor = colorInside.clone();
    mixedColor.lerp(colorOutside, particlesRadius / parameters.radius);
    particlesColor[i * 3 + 0] = mixedColor.r;
    particlesColor[i * 3 + 1] = mixedColor.g;
    particlesColor[i * 3 + 2] = mixedColor.b;
  }

  //网格
  const particlesGeometry = new THREE.BufferGeometry();
  //有关顶点的要设置各种属性
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPosition, 3));
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particlesColor, 3));

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  //物体放在一个对象中方便管理，后面添加物体不用做过多的修改

  //星空位置部分
  const starsCount = 4000;
  const starsPosition = new Float32Array(starsCount * 3);
  const starsColor = new Float32Array(starsCount * 3);

  for (let i = 0; i < starsCount; i++) {
    starsPosition[i * 3 + 0] = (Math.random() - 0.5) * 2 * 50;
    starsPosition[i * 3 + 1] = (Math.random() - 0.5) * 2 * 50;
    starsPosition[i * 3 + 2] = (Math.random() - 0.5) * 2 * 50;

    starsColor[i * 3 + 0] = 0.7;
    starsColor[i * 3 + 1] = 0.8;
    starsColor[i * 3 + 2] = 1.0;
  }

  const starsGeomotry = new THREE.BufferGeometry();
  starsGeomotry.setAttribute('position', new THREE.BufferAttribute(starsPosition, 3));
  starsGeomotry.setAttribute('color', new THREE.BufferAttribute(starsColor, 3));

  const starts = new THREE.Points(starsGeomotry, particlesMaterial);
  scene.add(starts);

  /**
   * 光线
   */

  /**
   * 相机
   */

   // camera.position.y = 5;
   // camera.position.z = 3;
   // camera.lookAt(new THREE.Vector3(0, 0, 0));
   camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
   scene.add(camera);
   updateCameraPosition(); // 初始化相机位置

  // 相机组

  // 渲染器
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000); // 设置背景颜色为黑色



  /**
   * 帧更新(动画)
   */
  const clock = new THREE.Clock();
  const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    //物体动画
    particles.rotation.z = elapsedTime * 0.1;

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

  // 监听鼠标按下事件
  canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
  });

  // 监听鼠标抬起事件
  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // 监听鼠标移动事件
  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
  
    const deltaX = event.clientX - previousMouseX;
    const deltaY = event.clientY - previousMouseY;
  
    // 根据鼠标拖动距离调整俯仰角和方位角
    theta -= deltaX * 0.005; // 左右拖动控制方位角
    phi += deltaY * 0.005; // 上下拖动控制俯仰角
  
    // 限制俯仰角范围，避免翻转
    phi = Math.max(0.5, Math.min(Math.PI - 0.5, phi));
    theta = Math.max(0.5 - Math.PI, Math.min(Math.PI - 0.5, theta));
  
    updateCameraPosition();
  
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
  });

  // 监听滚轮事件
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault(); // 阻止页面滚动
    if (event.deltaY < 0) {
      // 向上滚动，半径减小 (镜头推进)
      shotRadius -= zoomSpeed;
    } else {
      // 向下滚动，半径增大 (镜头拉远)
      shotRadius += zoomSpeed;
    }
  
    // 限制半径范围
    shotRadius = Math.max(2, Math.min(50, shotRadius));
  
    updateCameraPosition();
  });
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

  // 移除事件监听器
  canvas.removeEventListener('mousedown', (event) => {
    isDragging = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
  });
  canvas.removeEventListener('mouseup', () => {
    isDragging = false;
  });
  canvas.removeEventListener('mousemove', (event) => {
    if (!isDragging) return;
  
    const deltaX = event.clientX - previousMouseX;
    const deltaY = event.clientY - previousMouseY;
  
    // 根据鼠标拖动距离调整俯仰角和方位角
    theta -= deltaX * 0.005; // 左右拖动控制方位角
    phi += deltaY * 0.005; // 上下拖动控制俯仰角
  
    // 限制俯仰角范围，避免翻转
    phi = Math.max(0.5, Math.min(Math.PI - 0.5, phi));
    theta = Math.max(0.5 - Math.PI, Math.min(Math.PI - 0.5, theta));
  
    updateCameraPosition();
  
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
  });
  canvas.removeEventListener('wheel', (event) => {
    event.preventDefault(); // 阻止页面滚动
    if (event.deltaY < 0) {
      // 向上滚动，半径减小 (镜头推进)
      shotRadius -= zoomSpeed;
    } else {
      // 向下滚动，半径增大 (镜头拉远)
      shotRadius += zoomSpeed;
    }
  
    // 限制半径范围
    shotRadius = Math.max(2, Math.min(50, shotRadius));
  
    updateCameraPosition();
  });

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

