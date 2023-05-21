import type Game from "./Game";
import type THREE from "three";

interface Weapon {
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
  burst?: boolean;
  burstR?: number;
  rate?: number;
  rateChrg?: boolean;
  chrgTime?: number;
  ammo: number;
}

export declare class Player {
  constructor(...args: unknown[]);
  perks: number[];
  isKranked: boolean;
  chargeTime: number;
  attributes: {
    dmg: 1 | 0;
    drunk: 1 | 0;
    enraged: 1 | 0;
    fRate: 1 | 0;
    jump: 1 | 0;
    reload: 1 | 0;
    rooted: 1 | 0;
    siphon: 1 | 0;
    speed: 1 | 0;
    zap: 1 | 0;
  };
  classIndex: number;
  isPlayer: true;
  isAI: undefined;
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
  burstCount: number;
  active: boolean;
  objInstances: THREE.Object3D | null;
  waistMesh: THREE.Object3D | null;
  backMesh: (THREE.Object3D & { children: THREE.Mesh[] }) | null;
  headMesh: (THREE.Object3D & { children: THREE.Mesh[] }) | null;
  faceMesh: (THREE.Object3D & { children: THREE.Mesh[] }) | null;
  shoeMeshes: (THREE.Object3D & { children: THREE.Mesh[] })[];
  hatMesh: THREE.Mesh | null;
  bodyMesh: (THREE.Object3D & { children: THREE.Mesh[] }) | null;
  mergedArmMeshes: THREE.Mesh[];
  weaponMeshes: (THREE.Object3D & { children: THREE.Mesh[] })[];
  wristMeshes: THREE.Mesh[];
  armMeshes: THREE.Mesh[];
  legMeshes: THREE.Mesh[];
  headObj: THREE.Mesh | null;
  lowerBody: THREE.Object3D | null;
  upperBody: THREE.Object3D | null;
  meshHoldObj: THREE.Object3D | null;
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
  weapon: Weapon;
  procInputs(
    inputs: number[],
    game: Game,
    recon: boolean,
    moveLock?: boolean
  ): void;
}

export declare class manager {
  list: Player[];
  /**
   * returns the existing player or creates a new instance
   */
  add: (...args: unknown[]) => Player;
}
