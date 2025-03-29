import type AIManager from "./AI";
import type { AI } from "./AI";
import type Controls from "./Controls";
import type MapManager from "./GameMap";
import type { GameMode, SpawnPoint } from "./GameMap";
import type { Player, manager } from "./Player";
import type classes from "./classes";
import type * as THREE from "three";

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
  store: { skins: { type: number; weapon: number; classIndex: number }[] };
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
