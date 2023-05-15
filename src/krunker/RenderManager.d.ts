/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Player } from "./Player";
import type THREE from "three";

declare class RenderManager {
  constructor(...args: any[]);
  THREE: typeof THREE;
  scene: THREE.Scene;
  isMobile: boolean;
  invisMat: THREE.MeshBasicMaterial;
  camera: THREE.PerspectiveCamera;
  fpsCamera: THREE.PerspectiveCamera;
  tmpMouse: THREE.Vector2;
  tmpMouse2: THREE.Vector2;
  // do not modify:
  frustum: THREE.Frustum & {
    // containsPoint is a proxy function and always returns false:
    containsPoint: (point: THREE.Vector3) => false;
    // new functon:
    containPoint: (point: THREE.Vector3) => boolean;
  };
  adsFovMlt: number[];
  getPlayerWeaponId(player: Player): number;
  updateFrustum(): void;
  shakeX: number;
  shakeY: number;
  renderer: THREE.WebGLRenderer;
  render(...args: unknown[]): void;
}

export default RenderManager;
