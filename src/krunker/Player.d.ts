import type Game from "./Game";
import type * as THREE from "three";
import MapObject from "./Object";

interface Weapon {
  melee?: boolean;
  range?: number;
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

export interface Skin {
  ind: number;
  cnt: number;
}

export declare class Player {
  constructor(...args: unknown[]);
  hasAnims: boolean;
  perks: number[];
  isKranked: boolean;
  chargeTime: number;
  skins: number[];
  charms: number[];
  wristIndex: number;
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
  accid: number;
  id: number;
  sid: number;
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
  canThrow: boolean;
  weapon: Weapon;
  procInputs(
    inputs: number[],
    game: Game,
    recon: boolean,
    moveLock?: boolean
  ): void;
  init(
    z: number,
    x: number,
    y: number,
    name?: string,
    isYou?: boolean,
    isHacker?: boolean
  ): void;
}

export declare class manager {
  list: Player[];
  generateMeshes(plr: Player, ...args: unknown[]): any;
  /**
   * returns the existing player or creates a new instance
   */
  add(...args: unknown[]): Player;
  spray(...args: unknown[]): unknown;
  regenMeshes(player: Player): void;
  disposeMesh(player: Player): void;
  swapWeapon(player: Player, ...args: any[]): void;
  sprayPosition(
    player: Player,
    obj: MapObject | undefined,
    skin: number,
    atX: number,
    atY: number,
    atZ: number,
    sound: number
  ): void;
}
