import type * as THREE from "three";

// private
export declare class AI {
  isAI: true;
  isPlayer: undefined;
  active: boolean;
  x: number;
  y: number;
  z: number;
  xVel: number;
  yVel: number;
  zVel: number;
  height: number;
  mSize: number;
  scale: number;
  mYOff: number;
  mROff: number;
  name: string;
  sid: number;
  index: number;
  health: number;
  team: number;
  canBSeen: boolean;
  mesh: THREE.Object3D;
  meshRef: THREE.Object3D;
}

declare class AIManager {
  ais: AI[];
}

export default AIManager;
