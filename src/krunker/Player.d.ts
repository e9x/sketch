import type THREE from "three";

export declare const _canBSeen: unique symbol;

export declare class Player {
  constructor(...args: unknown[]);
  isYou: boolean;
  active: boolean;
  objInstances: THREE.Object3D | null;
  maxHealth: number;
  health: number;
  isPlayer: true;
  inputs: unknown[];
  ammos: number[];
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
  height: number;
  landBobY: number;
  recoilAnimY: number;
  weapon?: {
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
