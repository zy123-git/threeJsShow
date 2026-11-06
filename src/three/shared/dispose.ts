import * as THREE from 'three';
import type { Material, Object3D, WebGLRenderer } from 'three';

/** 释放材质自身的贴图与 GPU 资源（贴图属性 + ShaderMaterial uniforms 里的贴图） */
const disposeMaterial = (material: Material) => {
  const values = Object.values(material as unknown as Record<string, unknown>);
  for (const value of values) {
    if (value instanceof THREE.Texture) value.dispose();
  }

  const uniforms = (material as THREE.ShaderMaterial).uniforms;
  if (uniforms) {
    for (const uniform of Object.values(uniforms)) {
      if (uniform.value instanceof THREE.Texture) uniform.value.dispose();
    }
  }

  material.dispose();
};

/**
 * 递归释放 Object3D 子树上的 geometry / material / texture。
 * 兼容 Mesh、Line、Points 以及多材质等情况。
 */
export const disposeObject3D = (root: Object3D | null | undefined) => {
  if (!root) return;

  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) renderable.geometry.dispose();

    const material = renderable.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
};

/** 释放渲染器：dispose → 主动丢失 WebGL 上下文 → 移除 canvas，避免上下文泄漏 */
export const disposeRenderer = (renderer: WebGLRenderer | null | undefined) => {
  if (!renderer) return;

  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
};
