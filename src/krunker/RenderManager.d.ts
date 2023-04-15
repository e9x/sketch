import type THREE from "three";

declare class RenderManager {
  constructor(...args: any[]);
  THREE: typeof THREE;
  isMobile: boolean;
  invisMat: THREE.MeshBasicMaterial;
  camera: THREE.PerspectiveCamera;
  fpsCamera: THREE.PerspectiveCamera;
  tmpMouse: THREE.Vector2;
  tmpMouse2: THREE.Vector2;
  frustum: THREE.Frustum & {
    // fake function
    containsPoint: (point: THREE.Vector3) => false;
    containPoint: (point: THREE.Vector3) => boolean;
  };
  shakeX: number;
  shakeY: number;
}

export default RenderManager;
