import type AIManager from "./AI";
import type MapObject from "./Object";
import type { Player, manager } from "./Player";
import type Terrain from "./Terrain";
import type THREE from "three";

declare class Game {
  constructor(...args: unknown[]);
  AI: AIManager;
  mode: {
    noHPbars?: boolean;
    fakeNames?: boolean;
  };
  map: {
    terrain: Terrain | null;
    manager: {
      objects: MapObject[];
    };
  };
  latestData: boolean;
  isComp: boolean;
  COLLISIONS: unknown;
  THREE: typeof THREE;
  players: manager;
  config: unknown;
  raycaster: THREE.Raycaster;
  controls: {
    keys: Record<string, 0 | 1>;
    binds: unknown;
    spect: { target?: Player };
    tmpInpts: number[][];
    object: THREE.Object3D;
    pchObjc: THREE.Object3D;
    xDr: number;
    yDr: number;
  };
  ui: {
    loading: boolean;
  };
  roundId: string;
  sessionId: string;
  store: unknown;
  canSee(
    player: Player,
    x2: number,
    y2: number,
    z2: number,
    pad?: number | undefined,
    ntb?: number | undefined,
    skipTran?: boolean | undefined,
    getShort?: boolean | undefined,
    doRamps?: boolean | undefined
  ): false | number | null;
  get isServer(): boolean;
  get tmpPlayer(): Player | null;
}

export default Game;
