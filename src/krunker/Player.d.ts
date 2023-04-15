import type THREE from "three";

export declare const _canBSeen: unique symbol;

export declare class Player {
  constructor(...args: unknown[]);
  alias: string;
  name: string;
  fakeName: string | null;
  getName(): string;
  isYou: boolean;
  active: boolean;
  objInstances: THREE.Object3D | null;
  maxHealth: number;
  health: number;
  headMlt: number;
  reloadTimer: number;
  isPlayer: true;
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
  [_canBSeen]: boolean;
  x: number;
  y: number;
  z: number;
  team: string;
  velocity: THREE.Vector3;
  /**
   * height including crouch
   */
  adjustedHeight: number;
  height: number;
  landBobY: number;
  recoilAnimY: number;
  weapon: {
    // true or undefined = can't aim
    // false = can aim
    noAim?: boolean;
    nAuto?: boolean;
  };
}

export declare class manager {
  list: Player[];
  /**
   * returns the existing player or creates a new instance
   */
  add: (...args: unknown[]) => Player;
}
