import * as THREE from 'three';
import type { ColorRepresentation, Scene } from 'three';

export interface AmbientLightOptions {
  color?: ColorRepresentation;
  intensity?: number;
}

export interface DirectionalLightOptions extends AmbientLightOptions {
  position?: [number, number, number];
  castShadow?: boolean;
  shadowMapSize?: number;
}

export interface PointLightOptions extends AmbientLightOptions {
  position?: [number, number, number];
  distance?: number;
}

/**
 * 常用灯光组合的开关：传 false 表示不创建；不传则按默认值创建。
 * 复杂场景（需要阴影相机参数、半球光等）仍可自行创建灯，本工具不做限制。
 */
export interface BasicLightsOptions {
  ambient?: AmbientLightOptions | false;
  directional?: DirectionalLightOptions | false;
  point?: PointLightOptions | false;
}

export interface BasicLights {
  ambientLight: THREE.AmbientLight | null;
  directionalLight: THREE.DirectionalLight | null;
  pointLight: THREE.PointLight | null;
}

const DEFAULT_DIRECTIONAL_POSITION: [number, number, number] = [5, 10, 7.5];
const DEFAULT_POINT_POSITION: [number, number, number] = [0, 2, 0];

/** 创建并挂载常用灯光，返回灯光引用方便 GUI 调参 */
export const addBasicLights = (scene: Scene, options: BasicLightsOptions = {}): BasicLights => {
  const lights: BasicLights = {
    ambientLight: null,
    directionalLight: null,
    pointLight: null,
  };

  if (options.ambient !== false) {
    const { color = 0xffffff, intensity = 0.5 } = options.ambient ?? {};
    const light = new THREE.AmbientLight(color, intensity);
    scene.add(light);
    lights.ambientLight = light;
  }

  if (options.directional !== false) {
    const {
      color = 0xffffff,
      intensity = 0.8,
      position = DEFAULT_DIRECTIONAL_POSITION,
      castShadow = false,
      shadowMapSize = 2048,
    } = options.directional ?? {};

    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    if (castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    }
    scene.add(light);
    lights.directionalLight = light;
  }

  if (options.point) {
    const { color = 0xffffff, intensity = 1, position = DEFAULT_POINT_POSITION, distance = 0 } = options.point;
    const light = new THREE.PointLight(color, intensity, distance);
    light.position.set(...position);
    scene.add(light);
    lights.pointLight = light;
  }

  return lights;
};
