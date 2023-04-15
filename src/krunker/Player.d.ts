import type { Object3D, Vector3 } from "three";

export declare const _canBSeen: unique symbol;

export declare class Player {
  constructor(...args: unknown[]);
  isYou: boolean;
  active: boolean;
  objInstances: Object3D | null;
  maxHealth: number;
  health: number;
  isPlayer: true;
  inputs: unknown[];
  ammos: number[];
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
  velocity: Vector3;
  height: number;
  landBobY: number;
  recoilAnimY: number;
}

export declare class manager {
  list: Player[];
  /**
   * returns the existing player or creates a new instance
   */
  add: (...args: unknown[]) => Player;
}
