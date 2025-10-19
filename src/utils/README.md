# Three.js 模型点击事件处理器

## 模块简介

这是一个用于Three.js的独立点击事件处理模块，可以为3D模型中的特定子元素添加点击事件监听，而无需修改现有的Three.js代码。该模块使用射线检测（Raycaster）技术来实现对3D对象的点击检测。

## 主要功能

- 支持为模型中的特定子元素添加点击事件监听
- 提供多种子元素选择方式：
  - 通过名称精确匹配
  - 使用通配符模糊匹配
  - 使用自定义函数进行复杂筛选
- 支持添加和移除事件监听器
- 提供完整的TypeScript类型支持
- 自动清理资源，避免内存泄漏

## 安装与使用

### 导入模块

在Vue或其他TypeScript项目中，你可以通过以下方式导入该模块：

```typescript
// 方式1：导入类并创建新实例
import { ModelClickHandler } from '@/utils/threeModelClickHandler';

// 方式2：直接使用默认实例（适用于单场景应用）
import { defaultClickHandler } from '@/utils/threeModelClickHandler';
```

### 基本使用流程

1. **初始化点击处理器**

```typescript
// 创建实例（如果不使用默认实例）
const clickHandler = new ModelClickHandler();

// 在Three.js初始化后设置处理器
clickHandler.init(scene, camera, renderer.domElement);
```

2. **为模型子元素添加点击监听**

```typescript
// 确保模型已加载完成
if (model) {
  // 通过名称精确匹配
  clickHandler.addClickListener(
    model,
    'window_frame',  // 子元素名称
    (element, event, intersection) => {
      console.log('点击了窗户框:', element);
      // 添加视觉反馈或其他操作
    }
  );
  
  // 使用通配符匹配多个元素
  clickHandler.addClickListener(
    model,
    '*desk*',  // 匹配名称中包含desk的元素
    (element) => {
      console.log('点击了桌子:', element.name);
    }
  );
  
  // 使用自定义函数匹配元素
  clickHandler.addClickListener(
    model,
    (child) => child.isMesh && child.position.y > 1.0,  // 自定义筛选条件
    (element) => {
      console.log('点击了高处元素:', element.name);
    }
  );
}
```

3. **清理资源**

```typescript
// 在组件销毁或不再需要时清理资源
clickHandler.dispose();
```

## Vue组件集成示例

以下是在Vue 3 + TypeScript组件中集成该模块的完整示例：

```vue
<template>
  <div class="three-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ModelClickHandler } from '@/utils/threeModelClickHandler';
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

// 组件引用
const canvasRef = ref<HTMLCanvasElement>();

// Three.js 对象
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let model: THREE.Object3D | null = null;

// 点击处理器
const clickHandler = new ModelClickHandler();

// 初始化Three.js场景
const initThreeScene = async () => {
  await nextTick();
  
  if (!canvasRef.value) return;
  
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // 添加方向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  // 设置点击处理器
  clickHandler.init(scene, camera, canvasRef.value);
  
  // 加载模型
  await loadModel();
  
  // 开始动画循环
  animate();
};

// 加载3D模型
const loadModel = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    
    // 替换为你的模型路径
    loader.load(
      '/static/classroom/classroomMiniColor.gltf',
      (gltf) => {
        model = gltf.scene;
        scene.add(model);
        
        // 模型加载完成后添加点击事件
        setupClickListeners();
        
        resolve();
      },
      undefined,
      (error) => {
        console.error('模型加载失败:', error);
        reject(error);
      }
    );
  });
};

// 设置点击事件监听
const setupClickListeners = () => {
  if (!model) return;
  
  // 为窗户框添加点击事件
  clickHandler.addClickListener(
    model,
    'window_frame',
    (element, event, intersection) => {
      console.log('点击了窗户框:', element);
      
      // 添加视觉反馈 - 改变颜色
      if ((element as THREE.Mesh).material) {
        const mesh = element as THREE.Mesh;
        
        // 处理材质数组或单个材质
        const processMaterial = (mat: THREE.Material) => {
          // 保存原始颜色
          if (!element.userData.originalColor) {
            if (mat.color) {
              element.userData.originalColor = mat.color.clone();
            }
          }
          // 临时改变颜色
          if (mat.color) {
            mat.color.set(0xff0000);
            
            // 1秒后恢复原色
            setTimeout(() => {
              if (element.userData.originalColor) {
                mat.color.copy(element.userData.originalColor);
              }
            }, 1000);
          }
        };
        
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(processMaterial);
        } else if (mesh.material instanceof THREE.Material) {
          processMaterial(mesh.material);
        }
      }
    }
  );
  
  // 为所有桌子添加点击事件
  clickHandler.addClickListener(
    model,
    '*desk*',
    (element) => {
      console.log('点击了桌子:', element.name);
      // 这里可以添加桌子点击后的逻辑
    }
  );
};

// 动画循环
const animate = () => {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
};

// 窗口大小调整处理
const handleResize = () => {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

// 组件挂载时初始化
onMounted(() => {
  initThreeScene();
  window.addEventListener('resize', handleResize);
});

// 组件卸载时清理
onUnmounted(() => {
  // 清理点击处理器
  clickHandler.dispose();
  
  // 移除事件监听器
  window.removeEventListener('resize', handleResize);
  
  // 清理Three.js资源
  if (renderer) {
    renderer.dispose();
  }
});
</script>

<style scoped>
.three-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

canvas {
  width: 100%;
  height: 100%;
}
</style>
```

## API 文档

### ModelClickHandler 类

#### 构造函数

```typescript
constructor()
```

创建一个新的点击处理器实例。

#### 方法

##### init(scene, camera, canvas)

初始化点击事件处理器。

- **参数**:
  - `scene`: THREE.Scene - Three.js场景实例
  - `camera`: THREE.Camera - Three.js相机实例
  - `canvas`: HTMLCanvasElement - 渲染器的canvas元素

##### addClickListener(model, targetSelector, callback)

为模型中的特定子元素添加点击事件监听。

- **参数**:
  - `model`: THREE.Object3D - 父模型对象
  - `targetSelector`: string | ((child: THREE.Object3D) => boolean) - 子元素选择器
  - `callback`: (element: THREE.Object3D, event: MouseEvent, intersection: THREE.Intersection) => void - 点击事件回调函数
- **返回值**: boolean - 是否成功添加监听

##### removeClickListener(element, [callback])

移除元素的点击事件监听。

- **参数**:
  - `element`: THREE.Object3D - 要移除监听的元素
  - `callback`: (可选) 要移除的特定回调函数，不提供则移除所有

##### dispose()

销毁处理器，清理事件监听和资源。

### defaultClickHandler

预创建的点击处理器实例，可以直接使用，适用于大多数单场景应用。

## 注意事项

1. **模型加载时机**：确保在模型完全加载并添加到场景后再添加点击事件监听。

2. **资源清理**：务必在组件卸载或不再需要时调用`dispose()`方法，避免内存泄漏。

3. **材质处理**：Three.js中的材质可能是单个对象或数组，处理时需要注意区分。

4. **性能优化**：对于复杂场景，可能需要优化射线检测性能，例如限制检测范围或使用空间分区技术。

5. **选择器匹配**：通配符选择器以星号(*)开头，匹配名称中包含指定字符串的元素。

## 浏览器兼容性

支持所有现代浏览器，包括Chrome、Firefox、Safari和Edge。需要支持WebGL 1.0及以上版本。

## 许可证

MIT License