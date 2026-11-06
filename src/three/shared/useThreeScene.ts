import { nextTick, onMounted, onUnmounted, unref, type Ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useElementSize, type ElementSize } from '../../utils/useElementSize';
import { disposeObject3D, disposeRenderer } from './dispose';

/** canvas 来源：模板 ref、CSS 选择器或已获取的元素 */
export type ThreeCanvasSource = HTMLCanvasElement | Ref<HTMLCanvasElement | null> | string;

export interface ThreeCameraOptions {
  fov?: number;
  near?: number;
  far?: number;
  /** [x, y, z]，默认保持原点 */
  position?: [number, number, number];
}

export interface ThreeRendererOptions {
  alpha?: boolean;
  clearColor?: THREE.ColorRepresentation;
  /** setSize 的第三个参数（是否同步更新 canvas 的 CSS 尺寸），默认 true */
  updateStyle?: boolean;
  /** 显式设置像素比；不传则保持 three 默认值，避免改变原有清晰度 */
  pixelRatio?: number;
}

export interface ThreeControlsOptions {
  enableDamping?: boolean;
}

export interface ThreeSceneContext {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls | null;
  /** 与页面尺寸监听共享的响应式尺寸，供着色器 uResolution 等使用 */
  elementSize: Ref<ElementSize>;
}

export interface ThreeFrame {
  /** 自循环启动以来的总时长（秒） */
  elapsed: number;
  /** 距上一帧的间隔（秒） */
  delta: number;
}

export interface UseThreeSceneOptions {
  /** 尺寸监听容器，默认 '.three-container' */
  container?: string;
  canvas: ThreeCanvasSource;
  camera?: ThreeCameraOptions;
  renderer?: ThreeRendererOptions;
  /** 不传或传 false 表示不需要相机控制 */
  controls?: ThreeControlsOptions | false;
  /** 场景创建完成后调用；支持异步，帧循环会在其完成后启动 */
  onInit?: (context: ThreeSceneContext) => void | Promise<void>;
  /** 每帧回调；页面保留原有动画函数本体，仅由组合式调度 */
  onFrame?: (context: ThreeSceneContext, frame: ThreeFrame) => void;
  /** 是否在 onInit 完成后自动启动循环，默认 true */
  autoStart?: boolean;
}

/**
 * 统一 3D 页面脚手架：尺寸监听、场景/相机/渲染器/控制器创建、
 * 帧循环调度与资源释放。页面只保留自己的场景内容、GUI 与逐帧逻辑。
 *
 * 页面专有清理（事件、定时器、GSAP、loader 等）在组件自己的
 * onBeforeUnmount 里先执行，最后调用返回的 dispose() 释放场景资源；
 * 组合式内部的 onUnmounted 仅作为兜底（幂等）。
 */
export const useThreeScene = (options: UseThreeSceneOptions) => {
  const container = options.container ?? '.three-container';
  const { elementSize, updateElementSize, bindRenderer } = useElementSize(container);

  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let controls: OrbitControls | null = null;
  let context: ThreeSceneContext | null = null;

  let frameId: number | null = null;
  let running = false;
  let disposed = false;
  const clock = new THREE.Clock();

  const tick = () => {
    if (!running || !context) return;

    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;
    options.onFrame?.(context, { elapsed, delta });
    frameId = requestAnimationFrame(tick);
  };

  const start = () => {
    if (running || disposed || !context || !options.onFrame) return;
    running = true;
    clock.start();
    tick();
  };

  const stop = () => {
    running = false;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;

    stop();
    controls?.dispose();
    controls = null;

    disposeObject3D(scene);
    disposeRenderer(renderer);

    scene = null;
    camera = null;
    renderer = null;
    context = null;
  };

  onMounted(async () => {
    // 等待本轮 DOM 更新完成，确保模板 ref / 选择器与容器尺寸已就绪
    await nextTick();

    const source = options.canvas;
    const canvas =
      typeof source === 'string'
        ? (document.querySelector(source) as HTMLCanvasElement | null)
        : unref(source);

    if (!canvas) {
      console.warn(`[three] 未找到画布: ${String(source)}`);
      return;
    }

    // 先确定容器尺寸，再创建相机与渲染器
    updateElementSize();

    const cameraOptions = options.camera ?? {};
    const rendererOptions = options.renderer ?? {};

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      cameraOptions.fov ?? 75,
      elementSize.value.width / elementSize.value.height,
      cameraOptions.near ?? 0.1,
      cameraOptions.far ?? 1000
    );
    if (cameraOptions.position) {
      camera.position.set(...cameraOptions.position);
    }

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: rendererOptions.alpha ?? false,
    });
    renderer.setSize(
      elementSize.value.width,
      elementSize.value.height,
      rendererOptions.updateStyle ?? true
    );
    if (rendererOptions.pixelRatio !== undefined) {
      renderer.setPixelRatio(rendererOptions.pixelRatio);
    }
    if (rendererOptions.clearColor !== undefined) {
      renderer.setClearColor(rendererOptions.clearColor);
    }

    if (options.controls) {
      controls = new OrbitControls(camera, canvas);
      if (options.controls.enableDamping) {
        controls.enableDamping = true;
      }
    }

    // 响应式尺寸更新
    bindRenderer(renderer, camera);

    context = { canvas, scene, camera, renderer, controls, elementSize };

    try {
      await options.onInit?.(context);
    } catch (error) {
      console.error('[three] 场景初始化失败', error);
      return;
    }

    if (options.autoStart !== false) start();
  });

  onUnmounted(() => {
    dispose();
  });

  return { start, stop, dispose };
};
