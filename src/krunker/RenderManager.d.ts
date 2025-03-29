/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MapData, GameMode, MeshData } from "./GameMap";
import type { Player } from "./Player";
import type * as THREE from "three";

declare class RenderManager {
  constructor(...args: any[]);
  THREE: typeof THREE;
  scene: THREE.Scene;
  skyDome: THREE.Object3D;
  lastEnvId: number | null;
  updateGameEnvironment(id: number, newData?: any): void;
  updateLightMap(data: MapData): void;
  updateShadowMap(): void;
  skyDomeInit(config: any): THREE.Object3D;
  // init(game: any, config: any, idk: any, idk2: any): void;
  clearSkyDome(): void;
  loadTexture(
    material: THREE.Material,
    id: string,
    data: MeshData,
    mapCrap?: string
  ): THREE.Material;
  loadMesh(
    data: MeshData,
    x: number,
    y: number,
    z: number,
    rotation: [x: number, y: number, z: number],
    scale: number,
    scene: THREE.Object3D,
    doesnt: any,
    matter: any
  ): THREE.Mesh;
  init(
    map: MapData,
    mode: GameMode,
    noRender?: boolean,
    eventIndex?: number
  ): void;
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
  adsFov: number[];
  adsFovMlt: number[];
  getPlayerWeaponId(player: Player): number;
  updateFrustum(): void;
  shakeX: number;
  shakeY: number;
  renderer: THREE.WebGLRenderer;
  render(...args: unknown[]): void;
}

export default RenderManager;
