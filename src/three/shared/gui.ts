import { onUnmounted } from 'vue';

/** dat.GUI 与 lil-gui 的公共接口，二者都有 domElement 和 destroy */
export interface GuiLike {
  domElement?: HTMLElement;
  destroy?: () => void;
}

const destroyedGuis = new WeakSet<object>();

/** 幂等销毁：重复调用不会让 dat.GUI / lil-gui 报错 */
export const destroyGui = (gui: GuiLike | null | undefined) => {
  if (!gui || destroyedGuis.has(gui)) return;
  destroyedGuis.add(gui);

  try {
    gui.destroy?.();
  } catch (error) {
    console.warn('[three] GUI 销毁失败', error);
  }
};

/**
 * 把 GUI 的创建与销毁收口到组件生命周期：
 * 在 setup 作用域内调用，组件卸载时自动 destroy。
 *
 * @example
 * const gui = useGui(() => new GUI({ title: '参数' }));
 */
export const useGui = <T extends GuiLike>(factory: () => T): T => {
  const gui = factory();
  onUnmounted(() => destroyGui(gui));
  return gui;
};
