import * as THREE from 'three';

/**
 * Three.js模型子元素点击事件监听模块
 * 此模块可以独立引入，无需修改现有Three.js代码
 */
export class ModelClickHandler {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private clickListeners: Map<string, Function[]>;
  private targetElements: Map<string, THREE.Object3D>;
  private scene: THREE.Scene | null;
  private camera: THREE.Camera | null;
  private canvas: HTMLCanvasElement | null;
  private isInitialized: boolean;

  constructor() {
    // 射线投射器
    this.raycaster = new THREE.Raycaster();
    // 鼠标位置向量
    this.mouse = new THREE.Vector2();
    // 存储点击事件监听器的映射表
    this.clickListeners = new Map();
    // 存储目标子元素的引用
    this.targetElements = new Map();
    // 当前场景引用
    this.scene = null;
    // 当前相机引用
    this.camera = null;
    // 当前渲染器的canvas引用
    this.canvas = null;
    // 是否已初始化
    this.isInitialized = false;
  }

  /**
   * 初始化点击事件处理器
   * @param scene - Three.js场景
   * @param camera - Three.js相机
   * @param canvas - 渲染器的canvas元素
   */
  init(scene: THREE.Scene, camera: THREE.Camera, canvas: HTMLCanvasElement): void {
    if (this.isInitialized) return;
    
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    
    // 添加鼠标点击事件监听
    this.canvas.addEventListener('click', this.onClick.bind(this));
    
    this.isInitialized = true;
    console.log('ModelClickHandler 初始化完成');
  }

  /**
   * 为特定模型中的子元素添加点击事件监听
   * @param model - 父模型
   * @param targetSelector - 子元素选择器，可以是名称字符串或自定义筛选函数
   * @param callback - 点击事件回调函数
   * @returns 是否成功添加监听
   */
  addClickListener(
    model: THREE.Object3D,
    targetSelector: string | ((child: THREE.Object3D) => boolean),
    callback: (element: THREE.Object3D, event: MouseEvent, intersection: THREE.Intersection) => void
  ): boolean {
    if (!model || !targetSelector || typeof callback !== 'function') {
      console.error('无效的参数');
      return false;
    }

    // 查找目标子元素
    const targetElements = this.findTargetElements(model, targetSelector);
    
    if (targetElements.length === 0) {
      console.warn('未找到目标子元素');
      return false;
    }

    // 为每个找到的元素添加监听
    targetElements.forEach(element => {
      const elementId = this.getElementId(element);
      
      // 存储元素引用
      this.targetElements.set(elementId, element);
      
      // 存储回调函数
      if (!this.clickListeners.has(elementId)) {
        this.clickListeners.set(elementId, []);
      }
      this.clickListeners.get(elementId).push(callback);
      
      console.log(`已为元素 ${element.name || '未命名'} 添加点击监听`);
    });

    return true;
  }

  /**
   * 移除特定元素的点击事件监听
   * @param element - 要移除监听的元素
   * @param callback - 要移除的特定回调函数，不提供则移除所有
   */
  removeClickListener(
    element: THREE.Object3D,
    callback?: (element: THREE.Object3D, event: MouseEvent, intersection: THREE.Intersection) => void
  ): void {
    if (!element) return;
    
    const elementId = this.getElementId(element);
    
    if (this.clickListeners.has(elementId)) {
      if (callback) {
        // 移除特定回调
        const listeners = this.clickListeners.get(elementId);
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
          console.log(`已移除元素 ${element.name || '未命名'} 的特定点击监听`);
        }
        
        // 如果没有回调了，清理引用
        if (listeners.length === 0) {
          this.clickListeners.delete(elementId);
          this.targetElements.delete(elementId);
        }
      } else {
        // 移除所有回调
        this.clickListeners.delete(elementId);
        this.targetElements.delete(elementId);
        console.log(`已移除元素 ${element.name || '未命名'} 的所有点击监听`);
      }
    }
  }

  /**
   * 根据选择器查找目标子元素
   * @param parent - 父对象
   * @param selector - 选择器
   * @returns 找到的元素数组
   */
  private findTargetElements(
    parent: THREE.Object3D,
    selector: string | ((child: THREE.Object3D) => boolean)
  ): THREE.Object3D[] {
    const results = [];
    
    parent.traverse(child => {
      if (typeof selector === 'function') {
        // 自定义选择函数
        if (selector(child)) {
          results.push(child);
        }
      } else if (typeof selector === 'string') {
        // 按名称选择
        if (child.name === selector || 
            (selector.startsWith('*') && child.name.includes(selector.slice(1)))) {
          results.push(child);
        }
      }
    });
    
    return results;
  }

  /**
   * 鼠标点击事件处理
   * @param event - 鼠标事件
   */
  private onClick(event: MouseEvent): void {
    if (!this.scene || !this.camera || !this.canvas) return;
    
    // 计算鼠标在标准化设备坐标中的位置 (-1 到 1)
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // 设置射线投射器的射线
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // 计算物体和射线的焦点
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // 用于跟踪已触发回调的元素，防止重复触发
    const triggeredElements = new Set<string>();
    
    // 检查是否点击了我们监听的元素或其子元素
    for (let i = 0; i < intersects.length; i++) {
      let clickedElement = intersects[i].object;
      let hasListener = false;
      
      // 递归向上查找，检查当前元素或其父元素是否有注册的监听器
      while (clickedElement && !hasListener) {
        const elementId = this.getElementId(clickedElement);
        
        if (this.clickListeners.has(elementId) && !triggeredElements.has(elementId)) {
          // 触发所有注册的回调
          const callbacks = this.clickListeners.get(elementId);
          callbacks.forEach(callback => {
            try {
              callback(clickedElement, event, intersects[i]);
            } catch (error) {
              console.error('执行点击回调时出错:', error);
            }
          });
          // 标记为已触发，避免重复触发
          triggeredElements.add(elementId);
          hasListener = true;
        } else {
          // 向上查找父元素
          clickedElement = clickedElement.parent;
        }
      }
      
      // 如果已经找到并处理了有监听器的元素，可以选择中断循环
      // 这样可以确保只有最前面的可点击元素被触发
      if (hasListener) {
        break;
      }
    }
  }

  /**
   * 获取元素的唯一标识符
   * @param element - 要识别的元素
   * @returns 元素ID
   */
  private getElementId(element: THREE.Object3D): string {
    // 为元素添加唯一ID（如果没有）
    if (!element.userData._clickHandlerId) {
      element.userData._clickHandlerId = 'element_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return element.userData._clickHandlerId;
  }

  /**
   * 销毁处理器，清理事件监听
   */
  dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onClick);
    }
    
    // 清理引用
    this.clickListeners.clear();
    this.targetElements.clear();
    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.isInitialized = false;
    
    console.log('ModelClickHandler 已销毁');
  }
}

/**
 * 创建一个默认的点击处理器实例，便于快速使用
 */
export const defaultClickHandler = new ModelClickHandler();

/**
 * 使用示例
 * 
 * // 方式1：导入类并创建实例
 * import { ModelClickHandler } from '@/utils/threeModelClickHandler';
 * const clickHandler = new ModelClickHandler();
 * 
 * // 方式2：直接使用默认实例
 * import { defaultClickHandler } from '@/utils/threeModelClickHandler';
 * 
 * // 在Vue组件中的使用示例：
 * //
 * // <script setup lang="ts">
 * // import * as THREE from 'three';
 * // import { ModelClickHandler } from '@/utils/threeModelClickHandler';
 * // import { onMounted, onUnmounted, ref } from 'vue';
 * //
 * // const clickHandler = new ModelClickHandler();
 * // let scene: THREE.Scene;
 * // let camera: THREE.Camera;
 * // let renderer: THREE.WebGLRenderer;
 * // let classroomModel: THREE.Object3D | null = null;
 * //
 * // onMounted(() => {
 * //   // 初始化Three.js场景、相机、渲染器...
 * //   
 * //   // 设置点击处理器
 * //   clickHandler.init(scene, camera, renderer.domElement);
 * //   
 * //   // 加载模型后添加点击监听
 * //   loadModel().then(() => {
 * //     if (classroomModel) {
 * //       // 通过名称查找特定元素
 * //       clickHandler.addClickListener(
 * //         classroomModel,
 * //         'window_frame',
 * //         (element, event, intersection) => {
 * //           console.log('点击了窗户框:', element);
 * //           // 视觉反馈 - 改变颜色
 * //           if ((element as THREE.Mesh).material) {
 * //             const mesh = element as THREE.Mesh;
 * //             if (mesh.material instanceof THREE.Material) {
 * //               // 保存原始颜色
 * //               if (!element.userData.originalColor) {
 * //                 element.userData.originalColor = mesh.material.color.clone();
 * //               }
 * //               // 临时改变颜色
 * //               mesh.material.color.set(0xff0000);
 * //               // 1秒后恢复原色
 * //               setTimeout(() => {
 * //                 if (element.userData.originalColor) {
 * //                   mesh.material.color.copy(element.userData.originalColor);
 * //                 }
 * //               }, 1000);
 * //             }
 * //           }
 * //         }
 * //       );
 * //       
 * //       // 使用通配符查找多个元素
 * //       clickHandler.addClickListener(
 * //         classroomModel,
 * //         '*desk*',
 * //         (element) => {
 * //           console.log('点击了桌子:', element.name);
 * //         }
 * //       );
 * //       
 * //       // 使用自定义函数查找元素
 * //       clickHandler.addClickListener(
 * //         classroomModel,
 * //         (child) => child.isMesh && child.position.y > 1.0,
 * //         (element) => {
 * //           console.log('点击了高处元素:', element.name);
 * //         }
 * //       );
 * //     }
 * //   });
 * // });
 * //
 * // onUnmounted(() => {
 * //   // 清理资源
 * //   clickHandler.dispose();
 * // });
 * // </script>
 */