<template>
  <canvas class="webgl_2"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let canvas = null
let scene=null
let camera=null
let renderer=null
let objModel=null

let shotRadius = 2; // 初始半径
let phi = Math.PI * 0.3; // 初始俯仰角 (90度，看向原点)
let theta = Math.PI * 0; // 初始方位角

// 鼠标拖动控制相机
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

// 根据滚轮方向调整半径
const zoomSpeed = 0.25; // 缩放速度

function updateCameraPosition() {
  // 将球面坐标转换为笛卡尔坐标
  camera.position.x = shotRadius * Math.sin(phi) * Math.sin(theta);
  camera.position.y = shotRadius * Math.cos(phi);
  camera.position.z = shotRadius * Math.sin(phi) * Math.cos(theta);
  camera.lookAt(0, 0, 0); // 始终看向原点
};

const initThree= ()=> {
  //窗口大小信息
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * 场景环境设置
   */
  //画布
  canvas = document.querySelector('canvas.webgl_2');
  // 场景
  scene = new THREE.Scene();

  /**
   * 模型
   */
  const objLoader = new OBJLoader();
  
  objLoader.load(
    '../static/uploads_files_3356110_The_Holy_Bible.obj',
    (object) => {
      scene.add(object);
      object.position.set(0, 0.01, 0)
      console.log(object)
      objModel=object
    },
    (xhr) => {
      console.log(xhr)
    },
    (error) => {
      console.log(error)
    }
  )

  /**
   * 地面
   */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /**
   * 光照
   */
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  /**
   * 相机
   */
   camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
   scene.add(camera);
   updateCameraPosition(); // 初始化相机位置

  // 相机组

  // 渲染器
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000); // 设置背景颜色为黑色

  const clock = new THREE.Clock();
  const tick = () => {
    const elapsedTime = clock.getElapsedTime();

    // 渲染
    //这是整个流程的最后一步，在帧更新中渲染即可，
    renderer.render(scene, camera);

    // 继续调用 tick 函数
    requestAnimationFrame(tick);
  };
  tick();
}

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
    phi = Math.max(-0.2*Math.PI+0.5, Math.min(0.5*Math.PI - 0.2, phi));
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
    shotRadius = Math.max(0.25, Math.min(10, shotRadius));
  
    updateCameraPosition();
  });
});

onBeforeUnmount(() => {
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