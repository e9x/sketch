import type THREE from "three";

export declare class Player {
  constructor(...args: unknown[]);
  isPlayer: true;
  isYou: boolean;
  id: string;
  sid: string;
  premiumT?: number;
  alias: string;
  name: string;
  fakeName: string | null;
  deltaDiv: number;
  didShoot: boolean;
  getName(): string;
  lastGround?: {
    x: number;
    y: number;
    z: number;
    height: number;
  };
  active: boolean;
  objInstances: THREE.Object3D | null;
  headObj: THREE.Object3D | null;
  lowerBody: THREE.Object3D | null;
  upperBody: THREE.Object3D | null;
  maxHealth: number;
  health: number;
  hpChase: number;
  headMlt: number;
  swapTime: number;
  reloadTimer: number;
  scale: number;
  clan: number;
  level: number;
  hatIndex: number;
  headIndex: number;
  // between 0 and 1. 0 = aimed, 1 = aiming
  aimVal: number;
  inputs: unknown[];
  ammos: number[];
  aimTime: number;
  reloads: number[];
  loadoutIndex: number;
  onWall: number;
  wallJump: number; // bool
  onGround: boolean;
  airTime: number;
  crouchVal: number;
  canBSeen: boolean;
  x: number;
  y: number;
  z: number;
  team?: number;
  velocity: THREE.Vector3;
  /**
   * height including crouch
   */
  adjustedHeight: number;
  height: number;
  landBobY: number;
  recoilAnimY: number;
  weapon: {
    /**
     * true or undefined = can't aim
     * false = can aim
     */
    noAim?: boolean;
    nAuto?: boolean;
    /**
     * 0 - 1 or unset if no pierce
     */
    pierce?: number;
  };
}

export declare class manager {
  list: Player[];
  /**
   * returns the existing player or creates a new instance
   */
  add: (...args: unknown[]) => Player;
}
