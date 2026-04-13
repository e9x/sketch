import type AIManager from "./AI";
import type { AI } from "./AI";
import type Controls from "./Controls";
import type MapManager from "./GameMap";
import type { GameMode, SpawnPoint } from "./GameMap";
import type { Player, manager } from "./Player";
import type classes from "./classes";
import type * as THREE from "three";

export declare type SkinEntry = {
  id: number;
  index: number;
  name: string;
  type: number;
  weapon?: number;
  classIndex?: number;
  thumbnail?: string;
  rarity?: number;
  creator?: string;
  creators?: string[];
  rgb?: boolean;
  seas?: number;
  free?: boolean;
  keyW?: string;
};

export declare type RarityEntry = { color: string; animate?: boolean };

declare interface Attachment {
  req(player: Player, game: Game): boolean;
  [key: string | symbol]: any;
}

declare class Game {
  constructor(...args: unknown[]);
  AI: AIManager;
  classConfig: typeof classes;
  mode: GameMode;
  map: MapManager;
  latestData: boolean;
  isComp: boolean;
  COLLISIONS: unknown;
  THREE: typeof THREE;
  players: manager;
  attach: Attachment[];
  config: {
    thirdPerson?: boolean;
    fiRat?: number;
    movDrP?: number;
  };
  isSandbox: boolean;
  controls: Controls;
  ui: {
    loading: boolean;
  };
  broadcast(packet: string, ...data: any[]): void;
  addSpray(...args: unknown[]): unknown;
  roundId: string;
  sessionId: string;
  store: {
    rarities: RarityEntry[]; skins: { type: number; weapon: number; classIndex: number; name: string; id: number }[] 
};
  weapons: { name: string; src: string; icon: string; melee?: boolean; secondary?: boolean }[];
  canSee(
    target: Player | AI,
    x2: number,
    y2: number,
    z2: number,
    pad?: number | undefined,
    ntb?: number | undefined,
    skipTran?: boolean | undefined,
    getShort?: boolean | undefined,
    doRamps?: boolean | undefined
  ): boolean | number | null;
  getSpawnPoint(
    team?: number,
    player?: Player,
    pickFirstSpawn?: boolean,
    noWaitTimers?: boolean
  ): SpawnPoint;
  update(
    /** mIdleTimer */ fixedDelta: number,
    now: number,
    localPlayer: Player
  ): void;
  get isServer(): boolean;
  get tmpPlayer(): Player | null;
}

export default Game;
