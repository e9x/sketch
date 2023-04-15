import type THREE from "three";
import type {
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector2,
  Frustum,
} from "three";

declare class RenderManager {
  constructor(...args: any[]);
  THREE: typeof THREE;
  isMobile: boolean;
  invisMat: MeshBasicMaterial;
  camera: PerspectiveCamera;
  fpsCamera: PerspectiveCamera;
  tmpMouse: Vector2;
  tmpMouse2: Vector2;
  frustum: Frustum;
  shakeX: number;
  shakeY: number;
}

export default RenderManager;
